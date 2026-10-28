"""Where the wind data comes from.

By default the app reads a snapshot (CSV files in ``backend/data``) that was fetched from
Elexon by ``scripts/refresh_data.py``. January 2026 is history, so a snapshot keeps the
app fast and independent of Elexon's availability; ``DATA_SOURCE=elexon`` fetches the same
window live on first use instead.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd

from . import settings
from .elexon import ElexonClient
from .timeutils import local_midnight_utc

log = logging.getLogger(__name__)

ACTUALS_FILE = "wind_actuals.csv"
FORECASTS_FILE = "wind_forecasts.csv"
MANIFEST_FILE = "manifest.json"


@dataclass(frozen=True)
class WindData:
    actuals: pd.DataFrame  # half-hourly outturn: start_time, generation_mw, settlement_date, ...
    forecasts: pd.DataFrame  # every run: publish_time, start_time, generation_mw
    source: str  # "snapshot" or "elexon"
    fetched_at: datetime | None


def fetch_window() -> tuple[datetime, datetime]:
    """UTC ``[from, to)`` publish-time window of the forecast runs the app needs."""
    published_from = local_midnight_utc(settings.DATA_FIRST_PUBLISH_DATE)
    published_to = local_midnight_utc(settings.DATA_LAST_PUBLISH_DATE + timedelta(days=1))
    return published_from.to_pydatetime(), published_to.to_pydatetime()


def fetch_from_elexon(client: ElexonClient | None = None) -> WindData:
    published_from, published_to = fetch_window()
    owns_client = client is None
    client = client or ElexonClient()
    try:
        actuals = client.wind_actuals(settings.DATA_FIRST_DELIVERY_DATE, settings.LAST_DELIVERY_DATE)
        forecasts = client.wind_forecasts(published_from, published_to)
    finally:
        if owns_client:
            client.close()
    return WindData(actuals, forecasts, source="elexon", fetched_at=datetime.now(UTC))


def save_snapshot(data: WindData, data_dir: Path = settings.DATA_DIR) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    data.actuals.to_csv(data_dir / ACTUALS_FILE, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    data.forecasts.to_csv(data_dir / FORECASTS_FILE, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    published_from, published_to = fetch_window()
    manifest = {
        "fetched_at": (data.fetched_at or datetime.now(UTC)).isoformat(timespec="seconds"),
        "source": settings.ELEXON_BASE_URL,
        "actuals": {
            "dataset": "FUELHH (fuelType=WIND)",
            "settlement_date_from": settings.DATA_FIRST_DELIVERY_DATE.isoformat(),
            "settlement_date_to": settings.LAST_DELIVERY_DATE.isoformat(),
            "rows": len(data.actuals),
        },
        "forecasts": {
            "dataset": "WINDFOR",
            "publish_time_from": published_from.isoformat(),
            "publish_time_to_exclusive": published_to.isoformat(),
            "runs": int(data.forecasts["publish_time"].nunique()),
            "rows": len(data.forecasts),
        },
    }
    (data_dir / MANIFEST_FILE).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def load_snapshot(data_dir: Path = settings.DATA_DIR) -> WindData:
    actuals = pd.read_csv(data_dir / ACTUALS_FILE, dtype={"settlement_date": str})
    forecasts = pd.read_csv(data_dir / FORECASTS_FILE)
    for frame in (actuals, forecasts):
        for column in ("start_time", "publish_time"):
            frame[column] = pd.to_datetime(frame[column], utc=True)
        frame["generation_mw"] = frame["generation_mw"].astype(float)
    manifest_path = data_dir / MANIFEST_FILE
    fetched_at = None
    if manifest_path.exists():
        fetched_at = datetime.fromisoformat(json.loads(manifest_path.read_text("utf-8"))["fetched_at"])
    return WindData(actuals, forecasts, source="snapshot", fetched_at=fetched_at)


def load_data() -> WindData:
    if settings.DATA_SOURCE == "elexon":
        log.info("Fetching wind data live from Elexon")
        return fetch_from_elexon()
    log.info("Loading wind data snapshot from %s", settings.DATA_DIR)
    return load_snapshot()
