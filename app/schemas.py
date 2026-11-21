"""Pydantic response and request schemas for Server-Monitor API."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    beszel_online: bool = False
    version: str = "1.0.0"


class CpuMetrics(BaseModel):
    percent: float = 0.0
    cores: int = 2
    temp_c: Optional[int] = None
    temps: Dict[str, float] = Field(default_factory=dict)
    sparkline: List[float] = Field(default_factory=list)


class MemoryMetrics(BaseModel):
    percent: float = 0.0
    used_gb: float = 0.0
    total_gb: float = 0.0
    swap_used_gb: float = 0.0
    swap_total_gb: float = 0.0
    sparkline: List[float] = Field(default_factory=list)


class DiskMetrics(BaseModel):
    percent: float = 0.0
    used_gb: float = 0.0
    total_gb: float = 0.0
    sparkline: List[float] = Field(default_factory=list)


class BatteryMetrics(BaseModel):
    percent: Optional[int] = None
    state_code: Optional[int] = None
    is_ac: bool = True
    label_ru: str = "—"
    label_en: str = "—"


class LoadMetrics(BaseModel):
    min1: float = 0.0
    min5: float = 0.0
    min15: float = 0.0


class UptimeInfo(BaseModel):
    seconds: int = 0
    label_ru: str = "—"
    label_en: str = "—"


class ServerOverviewResponse(BaseModel):
    online: bool = False
    source: str = "beszel"
    hostname: str = "petroprog"
    system_name: str = "Ноутбук-сервер"
    uptime: UptimeInfo = Field(default_factory=UptimeInfo)
    cpu: CpuMetrics = Field(default_factory=CpuMetrics)
    memory: MemoryMetrics = Field(default_factory=MemoryMetrics)
    disk: DiskMetrics = Field(default_factory=DiskMetrics)
    battery: BatteryMetrics = Field(default_factory=BatteryMetrics)
    load: LoadMetrics = Field(default_factory=LoadMetrics)
    containers_online: int = 0
    containers_total: int = 0
    updated_at: str = ""


class ContainerItem(BaseModel):
    id: str
    name: str
    image: str = ""
    status: str = ""
    is_running: bool = True
    health: int = 0
    health_label: str = "running"
    cpu_pct: float = 0.0
    memory_mb: float = 0.0
    net_kbps: float = 0.0
    ports: str = ""
    stack: str = "other"
    stack_label_ru: str = "Прочие"
    stack_label_en: str = "Other"
    updatable: bool = False
    restart_policy: str = "unless-stopped"


class ContainersSummary(BaseModel):
    total: int = 0
    running: int = 0
    unhealthy: int = 0
    total_cpu_pct: float = 0.0
    total_ram_mb: float = 0.0


class ContainersResponse(BaseModel):
    online: bool = False
    source: str = "beszel"
    summary: ContainersSummary = Field(default_factory=ContainersSummary)
    containers: List[ContainerItem] = Field(default_factory=list)
    updated_at: str = ""


class NokiaHistoryPoint(BaseModel):
    level: int
    charging: bool = False
    recorded_at: str = ""


class NokiaAgentInfo(BaseModel):
    device: str = "Nokia 6.1"
    online: bool = False
    battery_level: Optional[int] = None
    charging: bool = False
    updated_at: Optional[str] = None
    history: List[NokiaHistoryPoint] = Field(default_factory=list)


class NetworkInterfaceInfo(BaseModel):
    name: str
    rx_bps: float = 0.0
    tx_bps: float = 0.0
    rx_total_bytes: int = 0
    tx_total_bytes: int = 0


class WifiInfo(BaseModel):
    ssid: Optional[str] = None
    rssi_dbm: Optional[int] = None


class WatchdogItem(BaseModel):
    id: str
    name_ru: str
    name_en: str
    interval: str
    active: bool = False


class AgentsOverviewResponse(BaseModel):
    nokia: NokiaAgentInfo = Field(default_factory=NokiaAgentInfo)
    sensors: Dict[str, Any] = Field(default_factory=dict)
    wifi: WifiInfo = Field(default_factory=WifiInfo)
    interfaces: List[NetworkInterfaceInfo] = Field(default_factory=list)
    bot_running: bool = False
    watchdogs: List[WatchdogItem] = Field(default_factory=list)
    quick_links: Dict[str, int] = Field(default_factory=dict)
    updated_at: str = ""


class NokiaBatteryPayload(BaseModel):
    level: int = Field(..., ge=0, le=100)
    charging: bool = False
