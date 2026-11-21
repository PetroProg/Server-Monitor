"""Agents, power, sensors, and watchdog status aggregator."""

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings
from app.schemas import (
    AgentsOverviewResponse,
    NokiaAgentInfo,
    NokiaHistoryPoint,
    WatchdogItem,
)
from app.services.beszel import beszel_client

logger = logging.getLogger("server_monitor.agents")

# Local fallback state if POST /api/agents/nokia/battery receives direct heartbeats
_local_nokia_override: Optional[Dict[str, Any]] = None
_local_nokia_history: List[NokiaHistoryPoint] = []


def record_local_nokia_heartbeat(level: int, charging: bool) -> Dict[str, Any]:
    """Stores an incoming Nokia 6.1 heartbeat in memory for fallback display."""
    global _local_nokia_override
    now_iso = datetime.now(timezone.utc).isoformat()
    point = NokiaHistoryPoint(level=level, charging=charging, recorded_at=now_iso)
    _local_nokia_history.append(point)
    if len(_local_nokia_history) > 48:
        del _local_nokia_history[:-48]

    _local_nokia_override = {
        "battery_level": level,
        "charging": charging,
        "updated_at": now_iso,
    }
    return _local_nokia_override


async def fetch_nokia_status() -> NokiaAgentInfo:
    """Fetches Nokia 6.1 battery status and history from news-ai with graceful fallback."""
    base = settings.NEWS_AI_API_URL.rstrip("/")
    level: Optional[int] = None
    charging = False
    updated_at: Optional[str] = None
    online = False
    history: List[NokiaHistoryPoint] = []

    try:
        async with httpx.AsyncClient(timeout=settings.NEWS_AI_TIMEOUT_SECONDS) as client:
            hist_resp, dev_resp = await asyncio.gather(
                client.get(f"{base}/api/devices/nokia/battery/history"),
                client.get(f"{base}/api/devices"),
                return_exceptions=True,
            )

            if not isinstance(hist_resp, Exception) and hist_resp.status_code == 200:
                payload = hist_resp.json()
                raw_pts = payload.get("points") or []
                for pt in raw_pts[-24:]:
                    if isinstance(pt, dict) and pt.get("level") is not None:
                        history.append(
                            NokiaHistoryPoint(
                                level=int(pt["level"]),
                                charging=bool(pt.get("charging", False)),
                                recorded_at=str(pt.get("recorded_at") or pt.get("time") or ""),
                            )
                        )
                if history:
                    latest = history[-1]
                    level = latest.level
                    charging = latest.charging
                    updated_at = latest.recorded_at
                    online = True

            if not isinstance(dev_resp, Exception) and dev_resp.status_code == 200:
                dev_data = dev_resp.json()
                devs = dev_data.get("devices") if isinstance(dev_data, dict) else dev_data
                if isinstance(devs, list):
                    for d in devs:
                        if isinstance(d, dict) and d.get("key_id") == "nokia_afk":
                            if d.get("battery_level") is not None:
                                level = int(d["battery_level"])
                            charging = bool(d.get("battery_charging", charging))
                            updated_at = d.get("battery_updated_at") or updated_at
                            online = bool(d.get("is_online", online))
                            break
    except Exception as exc:
        logger.debug("Could not reach news-ai for Nokia battery history: %s", exc)

    if _local_nokia_override:
        override_ts = _local_nokia_override.get("updated_at") or ""
        if not updated_at or override_ts >= updated_at:
            level = _local_nokia_override["battery_level"]
            charging = _local_nokia_override["charging"]
            updated_at = override_ts
            online = True
        if not history and _local_nokia_history:
            history = list(_local_nokia_history[-24:])

    return NokiaAgentInfo(
        device="Nokia 6.1",
        online=online,
        battery_level=level,
        charging=charging,
        updated_at=updated_at,
        history=history,
    )


async def get_agents_overview() -> AgentsOverviewResponse:
    """Aggregates Nokia 6.1, server sensors/network, and Telegram watchdogs."""
    now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")

    bundle = await beszel_client.fetch_system_bundle()
    containers = await beszel_client.get_containers()
    nokia = await fetch_nokia_status()

    wifi, interfaces, sensors = beszel_client.extract_wifi_and_interfaces(bundle)
    bot_running = any(c.name == "news_ai_bot" and c.is_running for c in containers.containers)

    watchdogs = [
        WatchdogItem(
            id="battery",
            name_ru="Монитор батареи сервера",
            name_en="Battery Monitor",
            interval="60s",
            active=bot_running,
        ),
        WatchdogItem(
            id="disk",
            name_ru="Контроль свободного диска",
            name_en="Disk Watchdog",
            interval="10m",
            active=bot_running,
        ),
        WatchdogItem(
            id="containers",
            name_ru="Контроль падений контейнеров",
            name_en="Container Watchdog",
            interval="30s",
            active=bot_running,
        ),
    ]

    return AgentsOverviewResponse(
        nokia=nokia,
        sensors=sensors,
        wifi=wifi,
        interfaces=interfaces,
        bot_running=bot_running,
        watchdogs=watchdogs,
        quick_links={
            "beszel": settings.BESZEL_PUBLIC_PORT,
            "adguard": settings.ADGUARD_PUBLIC_PORT,
        },
        updated_at=now_str,
    )
