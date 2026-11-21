"""Read-only Beszel Hub client for server and Docker container telemetry."""

from datetime import datetime, timezone
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.config import settings
from app.schemas import (
    BatteryMetrics,
    ContainerItem,
    ContainersResponse,
    ContainersSummary,
    CpuMetrics,
    DiskMetrics,
    LoadMetrics,
    MemoryMetrics,
    NetworkInterfaceInfo,
    ServerOverviewResponse,
    UptimeInfo,
    WifiInfo,
)

logger = logging.getLogger("server_monitor.beszel")

IGNORED_CONTAINER_SUBSTRINGS = ("hello-world", "inspiring_keldysh", "glances")


def _format_uptime(seconds: int) -> UptimeInfo:
    if seconds <= 0:
        return UptimeInfo(seconds=0, label_ru="—", label_en="—")
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    mins = (seconds % 3600) // 60
    if days > 0:
        return UptimeInfo(
            seconds=seconds,
            label_ru=f"{days}д {hours}ч",
            label_en=f"{days}d {hours}h",
        )
    return UptimeInfo(
        seconds=seconds,
        label_ru=f"{hours}ч {mins:02d}м",
        label_en=f"{hours}h {mins:02d}m",
    )


def _format_battery(bat_list: Any) -> BatteryMetrics:
    if not isinstance(bat_list, list) or not bat_list:
        return BatteryMetrics(percent=None, state_code=None, is_ac=True, label_ru="—", label_en="—")

    percent = int(bat_list[0])
    state_code = int(bat_list[1]) if len(bat_list) > 1 and isinstance(bat_list[1], (int, float)) else 0
    # distatus/battery: 2=Full, 3=Charging, 4=Discharging, 5=Idle/Not charging (AC threshold)
    is_ac = state_code != 4
    if state_code == 3:
        label_ru = f"{percent}% Зарядка"
        label_en = f"{percent}% Charging"
    elif is_ac:
        label_ru = f"{percent}% AC"
        label_en = f"{percent}% AC"
    else:
        label_ru = f"{percent}% Батарея"
        label_en = f"{percent}% Battery"

    return BatteryMetrics(
        percent=percent,
        state_code=state_code,
        is_ac=is_ac,
        label_ru=label_ru,
        label_en=label_en,
    )


def classify_container_stack(name: str) -> Tuple[str, str, str]:
    """Maps container name to logical stack group (id, Russian label, English label)."""
    lowered = name.lower().lstrip("/")
    if lowered.startswith("news_ai_"):
        return "ai_news", "AI News Stack", "AI News Stack"
    if any(
        k in lowered
        for k in ("jellyfin", "spotify", "tech-trainer", "films-list", "recipe_app", "tg_ai_bot", "server-monitor")
    ):
        return "media_apps", "Медиа и сервисы", "Media & Apps"
    return "other", "Прочие", "Other"


def _is_ignored_container(name: str, image: str) -> bool:
    combined = f"{name} {image}".lower()
    return any(marker in combined for marker in IGNORED_CONTAINER_SUBSTRINGS)


def _resolve_health_label(is_running: bool, health_code: int) -> str:
    if not is_running:
        return "stopped"
    if health_code == 2:
        return "healthy"
    if health_code == 3:
        return "unhealthy"
    if health_code == 1:
        return "starting"
    return "running"


class BeszelClient:
    """Async Beszel Hub API client with token caching and timeout guards."""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0
        self._system_id: Optional[str] = None

    def _base_url(self) -> str:
        return settings.BESZEL_URL.rstrip("/")

    async def _authenticate(self, client: httpx.AsyncClient, force: bool = False) -> Optional[str]:
        if not force and self._token and time.time() < self._token_expires_at:
            return self._token

        if not settings.BESZEL_EMAIL or not settings.BESZEL_PASSWORD:
            logger.warning("Beszel credentials are not configured in environment.")
            return None

        try:
            resp = await client.post(
                f"{self._base_url()}/api/collections/_superusers/auth-with-password",
                json={"identity": settings.BESZEL_EMAIL, "password": settings.BESZEL_PASSWORD},
            )
            if resp.status_code == 200:
                token = resp.json().get("token")
                if token:
                    self._token = token
                    self._token_expires_at = time.time() + 43200  # 12h cache
                    return token
            logger.warning("Beszel authentication failed with status %s", resp.status_code)
        except Exception as exc:
            logger.debug("Beszel auth request failed: %s", exc)
        return None

    async def _authed_get(
        self,
        client: httpx.AsyncClient,
        path: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[httpx.Response]:
        token = await self._authenticate(client)
        if not token:
            return None

        url = f"{self._base_url()}{path}"
        resp = await client.get(url, params=params, headers={"Authorization": token})
        if resp.status_code in (401, 403):
            token = await self._authenticate(client, force=True)
            if not token:
                return None
            resp = await client.get(url, params=params, headers={"Authorization": token})
        return resp

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=settings.BESZEL_TIMEOUT_SECONDS) as client:
                resp = await client.get(f"{self._base_url()}/api/health")
                return 200 <= resp.status_code < 400
        except Exception:
            return False

    async def _resolve_system_id(self, client: httpx.AsyncClient) -> Optional[str]:
        if self._system_id:
            return self._system_id

        resp = await self._authed_get(client, "/api/collections/systems/records", params={"perPage": 20})
        if not resp or resp.status_code != 200:
            return None

        items = resp.json().get("items", [])
        for item in items:
            name_lower = str(item.get("name", "")).lower()
            host = str(item.get("host", ""))
            if "сервер" in name_lower or "petroprog" in name_lower or host in ("127.0.0.1", "localhost"):
                self._system_id = item.get("id")
                return self._system_id
        if items:
            self._system_id = items[0].get("id")
        return self._system_id

    async def fetch_system_bundle(self) -> Optional[Dict[str, Any]]:
        """Fetches system record + last 20 system_stats time-series records from Beszel."""
        try:
            async with httpx.AsyncClient(timeout=settings.BESZEL_TIMEOUT_SECONDS) as client:
                sys_id = await self._resolve_system_id(client)
                if not sys_id:
                    return None

                sys_resp = await self._authed_get(client, f"/api/collections/systems/records/{sys_id}")
                if not sys_resp or sys_resp.status_code != 200:
                    self._system_id = None
                    return None

                stats_resp = await self._authed_get(
                    client,
                    "/api/collections/system_stats/records",
                    params={"filter": f"system='{sys_id}'", "sort": "-created", "perPage": 20},
                )
                records = stats_resp.json().get("items", []) if stats_resp and stats_resp.status_code == 200 else []
                return {"system": sys_resp.json(), "records": records}
        except Exception as exc:
            logger.warning("Failed to fetch Beszel system bundle: %s", exc)
            return None

    async def fetch_container_records(self) -> Optional[List[Dict[str, Any]]]:
        """Fetches container records from Beszel."""
        try:
            async with httpx.AsyncClient(timeout=settings.BESZEL_TIMEOUT_SECONDS) as client:
                resp = await self._authed_get(
                    client,
                    "/api/collections/containers/records",
                    params={"perPage": 100},
                )
                if not resp or resp.status_code != 200:
                    return None
                return resp.json().get("items", [])
        except Exception as exc:
            logger.warning("Failed to fetch Beszel container records: %s", exc)
            return None

    async def get_server_overview(self) -> ServerOverviewResponse:
        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        bundle = await self.fetch_system_bundle()
        containers_resp = await self.get_containers()

        if not bundle:
            return ServerOverviewResponse(
                online=False,
                containers_online=containers_resp.summary.running,
                containers_total=containers_resp.summary.total,
                updated_at=now_str,
            )

        sys_data = bundle["system"]
        info = sys_data.get("info") or {}
        records = bundle["records"]
        chrono = list(reversed(records))
        latest_st = (records[0].get("stats") or {}) if records else {}

        cpu_spark = [round(float(r["stats"]["cpu"]), 1) for r in chrono if "cpu" in (r.get("stats") or {})]
        ram_spark = [round(float(r["stats"]["mp"]), 1) for r in chrono if "mp" in (r.get("stats") or {})]
        disk_spark = [round(float(r["stats"]["dp"]), 1) for r in chrono if "dp" in (r.get("stats") or {})]

        cur_cpu = round(float(info.get("cpu", latest_st.get("cpu", 0.0))), 1)
        cur_ram_pct = round(float(info.get("mp", latest_st.get("mp", 0.0))), 1)
        cur_disk_pct = round(float(info.get("dp", latest_st.get("dp", 0.0))), 1)

        if not cpu_spark or cpu_spark[-1] != cur_cpu:
            cpu_spark.append(cur_cpu)
        if not ram_spark or ram_spark[-1] != cur_ram_pct:
            ram_spark.append(cur_ram_pct)
        if not disk_spark or disk_spark[-1] != cur_disk_pct:
            disk_spark.append(cur_disk_pct)

        raw_temps = latest_st.get("t") or {}
        temps: Dict[str, float] = {}
        if isinstance(raw_temps, dict):
            temps = {str(k): round(float(v), 1) for k, v in raw_temps.items() if isinstance(v, (int, float))}
        max_temp = int(max(temps.values())) if temps else None

        total_ram = round(float(latest_st.get("m", 0.0) or 0.0), 2)
        used_ram = round(float(latest_st.get("mu", 0.0) or (total_ram * cur_ram_pct / 100.0)), 2)
        swap_total = round(float(latest_st.get("s", 0.0) or 0.0), 2)
        swap_used = round(float(latest_st.get("su", 0.0) or 0.0), 2)

        total_disk = round(float(latest_st.get("d", 0.0) or 0.0), 1)
        used_disk = round(float(latest_st.get("du", 0.0) or (total_disk * cur_disk_pct / 100.0)), 1)

        la = info.get("la") or latest_st.get("la") or [0.0, 0.0, 0.0]
        load = LoadMetrics(
            min1=round(float(la[0]), 2) if len(la) > 0 else 0.0,
            min5=round(float(la[1]), 2) if len(la) > 1 else 0.0,
            min15=round(float(la[2]), 2) if len(la) > 2 else 0.0,
        )

        uptime = _format_uptime(int(info.get("u", 0) or 0))
        battery = _format_battery(info.get("bat") or latest_st.get("bat"))

        return ServerOverviewResponse(
            online=sys_data.get("status") == "up",
            source="beszel",
            hostname="petroprog",
            system_name=str(sys_data.get("name") or "Ноутбук-сервер"),
            uptime=uptime,
            cpu=CpuMetrics(
                percent=cur_cpu,
                cores=int(info.get("t", 2) or 2),
                temp_c=max_temp,
                temps=temps,
                sparkline=cpu_spark[-20:],
            ),
            memory=MemoryMetrics(
                percent=cur_ram_pct,
                used_gb=used_ram,
                total_gb=total_ram,
                swap_used_gb=swap_used,
                swap_total_gb=swap_total,
                sparkline=ram_spark[-20:],
            ),
            disk=DiskMetrics(
                percent=cur_disk_pct,
                used_gb=used_disk,
                total_gb=total_disk,
                sparkline=disk_spark[-20:],
            ),
            battery=battery,
            load=load,
            containers_online=containers_resp.summary.running,
            containers_total=containers_resp.summary.total,
            updated_at=now_str,
        )

    async def get_containers(self) -> ContainersResponse:
        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        raw_items = await self.fetch_container_records()
        if raw_items is None:
            return ContainersResponse(online=False, updated_at=now_str)

        # Beszel retains older container IDs briefly after container recreation;
        # keep the freshest record per name and drop stale records >2 min behind latest heartbeat.
        updated_vals = [int(r.get("updated") or 0) for r in raw_items if r.get("updated")]
        max_updated = max(updated_vals) if updated_vals else 0

        deduped_by_name: Dict[str, Dict[str, Any]] = {}
        for raw in raw_items:
            name = str(raw.get("name") or "").lstrip("/")
            image = str(raw.get("image") or "")
            if not name or _is_ignored_container(name, image):
                continue
            upd = int(raw.get("updated") or 0)
            if max_updated > 0 and upd > 0 and (max_updated - upd) > 120_000:
                continue
            prev = deduped_by_name.get(name)
            if not prev or upd >= int(prev.get("updated") or 0):
                deduped_by_name[name] = raw

        items: List[ContainerItem] = []
        running_count = 0
        unhealthy_count = 0
        total_cpu = 0.0
        total_ram = 0.0

        for raw in deduped_by_name.values():
            name = str(raw.get("name") or "").lstrip("/")
            image = str(raw.get("image") or "")

            status_str = str(raw.get("status") or "")
            is_running = status_str.lower().startswith("up")
            health_code = int(raw.get("health") or 0)
            health_label = _resolve_health_label(is_running, health_code)

            cpu_pct = round(float(raw.get("cpu") or 0.0), 2)
            mem_mb = round(float(raw.get("memory") or 0.0), 1)
            net_kbps = round(float(raw.get("net") or 0.0), 1)

            if is_running:
                running_count += 1
            if health_label == "unhealthy" or not is_running:
                unhealthy_count += 1

            total_cpu += cpu_pct
            total_ram += mem_mb

            stack_id, label_ru, label_en = classify_container_stack(name)

            items.append(
                ContainerItem(
                    id=str(raw.get("id") or name),
                    name=name,
                    image=image,
                    status=status_str,
                    is_running=is_running,
                    health=health_code,
                    health_label=health_label,
                    cpu_pct=cpu_pct,
                    memory_mb=mem_mb,
                    net_kbps=net_kbps,
                    ports=str(raw.get("ports") or ""),
                    stack=stack_id,
                    stack_label_ru=label_ru,
                    stack_label_en=label_en,
                    updatable=bool(raw.get("updatable", False)),
                    restart_policy="unless-stopped",
                )
            )

        stack_order = {"ai_news": 0, "media_apps": 1, "other": 2}
        items.sort(key=lambda c: (stack_order.get(c.stack, 9), c.name.lower()))

        return ContainersResponse(
            online=True,
            source="beszel",
            summary=ContainersSummary(
                total=len(items),
                running=running_count,
                unhealthy=unhealthy_count,
                total_cpu_pct=round(total_cpu, 1),
                total_ram_mb=round(total_ram, 1),
            ),
            containers=items,
            updated_at=now_str,
        )

    @staticmethod
    def extract_wifi_and_interfaces(bundle: Optional[Dict[str, Any]]) -> Tuple[WifiInfo, List[NetworkInterfaceInfo], Dict[str, Any]]:
        if not bundle:
            return WifiInfo(), [], {}

        sys_data = bundle["system"]
        info = sys_data.get("info") or {}
        records = bundle["records"]
        latest_st = (records[0].get("stats") or {}) if records else {}

        ssid: Optional[str] = None
        rssi_dbm: Optional[int] = None
        wf = info.get("wf") or {}
        if isinstance(wf, dict):
            for val in wf.values():
                if isinstance(val, dict):
                    ssid = val.get("s") or ssid
                    if isinstance(val.get("r"), (int, float)):
                        rssi_dbm = int(val["r"])
                elif isinstance(val, (int, float)):
                    rssi_dbm = int(val)

        interfaces: List[NetworkInterfaceInfo] = []
        ni = latest_st.get("ni") or {}
        if isinstance(ni, dict):
            for iface, vals in ni.items():
                if isinstance(vals, list) and len(vals) >= 4:
                    interfaces.append(
                        NetworkInterfaceInfo(
                            name=str(iface),
                            rx_bps=float(vals[0] or 0),
                            tx_bps=float(vals[1] or 0),
                            rx_total_bytes=int(vals[2] or 0),
                            tx_total_bytes=int(vals[3] or 0),
                        )
                    )
        interfaces.sort(key=lambda x: x.name)

        raw_temps = latest_st.get("t") or {}
        temps = (
            {str(k): round(float(v), 1) for k, v in raw_temps.items() if isinstance(v, (int, float))}
            if isinstance(raw_temps, dict)
            else {}
        )
        la = info.get("la") or latest_st.get("la") or [0.0, 0.0, 0.0]
        sensors = {
            "temps": temps,
            "load": {
                "min1": round(float(la[0]), 2) if len(la) > 0 else 0.0,
                "min5": round(float(la[1]), 2) if len(la) > 1 else 0.0,
                "min15": round(float(la[2]), 2) if len(la) > 2 else 0.0,
            },
            "swap_used_gb": round(float(latest_st.get("su", 0.0) or 0.0), 2),
            "swap_total_gb": round(float(latest_st.get("s", 0.0) or 0.0), 2),
        }
        return WifiInfo(ssid=ssid, rssi_dbm=rssi_dbm), interfaces, sensors


beszel_client = BeszelClient()
