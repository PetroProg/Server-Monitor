"""FastAPI entrypoint for the standalone mobile-first Server-Monitor PWA."""

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.schemas import (
    AgentsOverviewResponse,
    ContainersResponse,
    HealthResponse,
    NokiaBatteryPayload,
    ServerOverviewResponse,
)
from app.services.agents import get_agents_overview, record_local_nokia_heartbeat
from app.services.beszel import beszel_client

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"

app = FastAPI(
    title="Petroprog Server Monitor",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)

if (WEB_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(WEB_DIR / "css")), name="css")
if (WEB_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(WEB_DIR / "js")), name="js")
if (WEB_DIR / "icons").exists():
    app.mount("/icons", StaticFiles(directory=str(WEB_DIR / "icons")), name="icons")


def _serve_html(filename: str) -> HTMLResponse:
    target = WEB_DIR / filename
    if not target.exists():
        return HTMLResponse(f"<h1>{filename} not found</h1>", status_code=404)
    return HTMLResponse(
        content=target.read_text(encoding="utf-8"),
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/", response_class=HTMLResponse)
@app.get("/server", response_class=HTMLResponse)
async def page_server() -> HTMLResponse:
    return _serve_html("server.html")


@app.get("/agents", response_class=HTMLResponse)
async def page_agents() -> HTMLResponse:
    return _serve_html("agents.html")


@app.get("/settings", response_class=HTMLResponse)
async def page_settings() -> HTMLResponse:
    return _serve_html("settings.html")


@app.get("/manifest.webmanifest")
@app.get("/manifest.json")
async def serve_manifest() -> FileResponse:
    return FileResponse(
        path=str(WEB_DIR / "manifest.webmanifest"),
        media_type="application/manifest+json",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/sw.js")
async def serve_sw() -> FileResponse:
    return FileResponse(
        path=str(WEB_DIR / "sw.js"),
        media_type="application/javascript",
        headers={
            "Service-Worker-Allowed": "/",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@app.get("/favicon.ico")
async def serve_favicon() -> FileResponse:
    ico = WEB_DIR / "icons" / "favicon.svg"
    return FileResponse(path=str(ico), media_type="image/svg+xml")


@app.get("/api/health", response_model=HealthResponse)
async def api_health() -> HealthResponse:
    beszel_ok = await beszel_client.check_health()
    return HealthResponse(status="ok", beszel_online=beszel_ok, version="1.0.0")


@app.get("/api/server/overview", response_model=ServerOverviewResponse)
async def api_server_overview() -> ServerOverviewResponse:
    return await beszel_client.get_server_overview()


@app.get("/api/server/containers", response_model=ContainersResponse)
async def api_server_containers() -> ContainersResponse:
    return await beszel_client.get_containers()


@app.get("/api/agents/overview", response_model=AgentsOverviewResponse)
async def api_agents_overview() -> AgentsOverviewResponse:
    return await get_agents_overview()


@app.post("/api/agents/nokia/battery")
async def api_nokia_heartbeat(payload: NokiaBatteryPayload) -> dict:
    data = record_local_nokia_heartbeat(payload.level, payload.charging)
    return {"success": True, **data}
