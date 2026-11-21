"""Unit and API tests for Server-Monitor."""

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.beszel import (
    BeszelClient,
    _format_battery,
    _format_uptime,
    classify_container_stack,
)

client = TestClient(app)


def test_pages_serve_html_200():
    for path in ("/", "/server", "/agents", "/settings"):
        resp = client.get(path)
        assert resp.status_code == 200
        assert "<!DOCTYPE html>" in resp.text


def test_manifest_and_sw_routes():
    m_resp = client.get("/manifest.webmanifest")
    assert m_resp.status_code == 200
    assert m_resp.json()["short_name"] == "Petroprog"

    sw_resp = client.get("/sw.js")
    assert sw_resp.status_code == 200
    assert sw_resp.headers.get("service-worker-allowed") == "/"


def test_no_restart_routes_exist():
    routes = [r.path for r in app.routes]
    assert not any("restart" in p for p in routes)


def test_classify_container_stack():
    assert classify_container_stack("news_ai_app")[0] == "ai_news"
    assert classify_container_stack("jellyfin-audio")[0] == "media_apps"
    assert classify_container_stack("tech-trainer")[0] == "media_apps"
    assert classify_container_stack("films-list")[0] == "media_apps"
    assert classify_container_stack("custom-svc")[0] == "other"


def test_battery_and_uptime_formatters():
    bat_ac = _format_battery([98, 5])
    assert bat_ac.percent == 98
    assert bat_ac.is_ac is True
    assert "98%" in bat_ac.label_ru

    bat_dc = _format_battery([42, 4])
    assert bat_dc.is_ac is False
    assert "Батарея" in bat_dc.label_ru

    up = _format_uptime(3361339)
    assert "38д" in up.label_ru
    assert "38d" in up.label_en


async def test_beszel_overview_and_containers_parsing():
    bz = BeszelClient()
    sample_bundle = {
        "system": {
            "id": "sys1",
            "name": "Ноутбук-сервер",
            "status": "up",
            "info": {"t": 2, "u": 90000, "cpu": 24.5, "mp": 60.0, "dp": 74.5, "la": [1.1, 1.0, 0.9], "bat": [98, 5]},
        },
        "records": [
            {
                "stats": {
                    "cpu": 24.5,
                    "mp": 60.0,
                    "dp": 74.5,
                    "m": 3.23,
                    "mu": 1.94,
                    "s": 3.73,
                    "su": 0.32,
                    "d": 97.87,
                    "du": 72.9,
                    "t": {"coretemp_core_0": 43, "coretemp_core_2": 47},
                }
            }
        ],
    }
    sample_containers = [
        {"id": "old", "name": "news_ai_app", "image": "news-ai-app", "status": "Up 3 hours", "updated": 1000, "health": 0, "cpu": 0.0, "memory": 100.0},
        {"id": "1", "name": "news_ai_app", "image": "news-ai-app", "status": "Up 2 minutes", "updated": 200000, "health": 0, "cpu": 2.1, "memory": 210.5, "net": 12, "ports": "8000"},
        {"id": "2", "name": "glances", "image": "nicolargo/glances:latest", "status": "Up 2 hours", "updated": 200000, "health": 0, "cpu": 1.0, "memory": 70.0},
        {"id": "3", "name": "tech-trainer", "image": "tech-trainer", "status": "Up 2 hours", "updated": 200000, "health": 2, "cpu": 0.1, "memory": 12.0, "ports": "8080"},
    ]

    with patch.object(bz, "fetch_system_bundle", new=AsyncMock(return_value=sample_bundle)), \
         patch.object(bz, "fetch_container_records", new=AsyncMock(return_value=sample_containers)):
        ov = await bz.get_server_overview()
        assert ov.online is True
        assert ov.cpu.percent == 24.5
        assert ov.cpu.temp_c == 47
        assert ov.memory.total_gb == 3.23
        assert ov.containers_total == 2  # glances filtered out

        ct = await bz.get_containers()
        assert ct.summary.total == 2
        assert ct.summary.running == 2
        assert all(c.name != "glances" for c in ct.containers)


def test_nokia_heartbeat_and_agents_fallback():
    post_resp = client.post("/api/agents/nokia/battery", json={"level": 84, "charging": False})
    assert post_resp.status_code == 200
    assert post_resp.json()["battery_level"] == 84

    with patch("app.services.agents.beszel_client.fetch_system_bundle", new=AsyncMock(return_value=None)), \
         patch("app.services.agents.beszel_client.get_containers", new=AsyncMock(return_value=type("R", (), {"containers": []})())):
        resp = client.get("/api/agents/overview")
        assert resp.status_code == 200
        body = resp.json()
        assert body["nokia"]["battery_level"] == 84
        assert body["nokia"]["charging"] is False
