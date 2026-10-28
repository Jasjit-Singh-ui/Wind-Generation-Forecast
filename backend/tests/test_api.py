"""End-to-end API tests over a synthetic window where outturn is always 90% of the forecast."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import settings
from app.analytics import Analytics
from app.api import get_analytics
from app.main import create_app
from tests.conftest import PUBLISH_SLOTS


@pytest.fixture(scope="module")
def client(synthetic_data):
    app = create_app()
    analytics = Analytics(synthetic_data)
    app.dependency_overrides[get_analytics] = lambda: analytics
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta_describes_the_scope(client):
    meta = client.get("/api/meta").json()
    assert meta["window"]["first_decision_date"] == "2026-01-01"
    assert meta["window"]["first_delivery_date"] == "2026-01-02"
    assert meta["window"]["last_delivery_date"] == "2026-02-01"
    assert [p["time"] for p in meta["decision_presets"]] == ["09:20", "09:50", "15:30"]
    assert meta["data"]["missing_periods"] == 0
    assert len(meta["data"]["publish_slots"]) == 8


def test_day_ahead_selects_the_decision_run_and_adjusts_it(client):
    body = client.get("/api/day-ahead", params={"date": "2026-01-15", "decision_time": "09:20"}).json()
    decision = body["decision"]
    assert decision["decision_date"] == "2026-01-14"
    assert decision["cutoff"] == "2026-01-14T09:20:00Z"
    assert decision["latest_run"] == "2026-01-14T07:30:00Z"
    assert decision["minutes_before_cutoff"] == 110
    assert decision["hours_covered"] == decision["hours_in_day"] == 24
    assert body["previous_date"] == "2026-01-14" and body["next_date"] == "2026-01-16"
    assert body["calibration"]["ratio_mid"] == pytest.approx(0.9)
    assert len(body["actuals"]) == 48
    assert len(body["vintages"]) == 16
    assert sum(v["used_for_decision"] for v in body["vintages"]) == 1
    # The outturn is exactly 90% of the forecast, so the adjusted forecast is perfect.
    assert body["summary"]["adjusted"]["mae_mw"] == 0
    assert body["summary"]["official"]["bias_mw"] > 0
    first = body["hours"][0]
    assert first["adjusted_mw"] == pytest.approx(0.9 * first["forecast_mw"], abs=0.1)


def test_day_ahead_rejects_days_outside_the_window(client):
    assert client.get("/api/day-ahead", params={"date": "2026-01-01"}).status_code == 404
    assert client.get("/api/day-ahead", params={"date": "2026-03-01"}).status_code == 404


@pytest.mark.parametrize(
    "params",
    [
        {"date": "2026-01-15", "decision_time": "24:00"},
        {"date": "2026-01-15", "decision_time": "9:20"},
        {"date": "15/01/2026"},
        {"date": "2026-01-15", "coverage": 70},
    ],
)
def test_invalid_parameters_are_rejected(client, params):
    assert client.get("/api/day-ahead", params=params).status_code == 422


def test_accuracy_covers_every_delivery_hour(client):
    body = client.get("/api/accuracy", params={"decision_time": "09:50", "coverage": 90}).json()
    days = (settings.LAST_DELIVERY_DATE - settings.FIRST_DELIVERY_DATE).days + 1
    assert body["period"]["days"] == days == len(body["daily"])
    assert body["period"]["hours"] == days * 24 == len(body["series"])
    assert body["official"]["bias_mw"] > 0
    assert body["adjusted"]["mae_mw"] == 0
    assert len(body["by_hour"]) == 24
    assert sum(b["official"] for b in body["histogram"]) == body["period"]["hours"]
    assert body["energy"]["adjusted_mwh"] == pytest.approx(body["energy"]["actual_mwh"], rel=1e-6)


def test_horizon_profiles(client):
    body = client.get("/api/horizon").json()
    # Midnight plus one step just after each of the 8 daily publish slots.
    assert [p["from_time"] for p in body["decision_times"]] == ["00:00", *PUBLISH_SLOTS]
    # Before the first run of D-1, D-2's runs only reach 21:00 on D: 22 of 24 hours.
    assert body["decision_times"][0]["n"] == 31 * 22
    assert all(p["n"] == 31 * 24 for p in body["decision_times"][1:])
    assert all(p["mae_adjusted_mw"] == 0 for p in body["decision_times"])
    assert body["lead_time"][0]["lead_from_h"] == 0


def test_api_responses_are_cacheable_but_health_is_not(client):
    assert "max-age" in client.get("/api/meta").headers["cache-control"]
    assert client.get("/api/health").headers["cache-control"] == "no-store"


def test_day_iteration_matches_settings(synthetic_data):
    analytics = Analytics(synthetic_data)
    assert analytics.delivery_days[0] == date(2026, 1, 2)
    assert analytics.delivery_days[-1] == date(2026, 2, 1)
