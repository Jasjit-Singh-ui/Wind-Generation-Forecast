"""Client for the two Elexon BMRS (Insights Solution) datasets the app uses.

* FUELHH  - half-hourly generation outturn by fuel type; we keep ``fuelType == "WIND"``.
* WINDFOR - wind generation forecast runs (hourly values, published ~8 times a day).

The API returns UTC timestamps. Responses are normalised to tidy DataFrames with
snake_case columns so the rest of the code never sees the raw payload shape.
"""

from __future__ import annotations

import logging
import time as clock
from datetime import date, datetime, timedelta
from typing import Any

import httpx
import pandas as pd

from . import settings

log = logging.getLogger(__name__)

ACTUAL_COLUMNS = ["start_time", "settlement_date", "settlement_period", "generation_mw", "publish_time"]
FORECAST_COLUMNS = ["publish_time", "start_time", "generation_mw"]


class ElexonError(RuntimeError):
    """Raised when the Elexon API cannot be reached or returns an unusable response."""


class ElexonClient:
    def __init__(
        self,
        base_url: str = settings.ELEXON_BASE_URL,
        timeout_s: float = settings.ELEXON_TIMEOUT_S,
        max_attempts: int = 4,
        http: httpx.Client | None = None,
    ) -> None:
        self._http = http or httpx.Client(base_url=base_url, timeout=timeout_s)
        self._max_attempts = max_attempts

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> ElexonClient:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def wind_actuals(self, first_day: date, last_day: date, chunk_days: int = 14) -> pd.DataFrame:
        """Half-hourly wind outturn for settlement days ``first_day..last_day`` (inclusive)."""
        rows: list[dict[str, Any]] = []
        start = first_day
        while start <= last_day:
            end = min(start + timedelta(days=chunk_days - 1), last_day)
            rows += self._get(
                "/datasets/FUELHH/stream",
                {
                    "settlementDateFrom": start.isoformat(),
                    "settlementDateTo": end.isoformat(),
                    "fuelType": "WIND",
                },
            )
            start = end + timedelta(days=1)
        return normalise_actuals(rows)

    def wind_forecasts(
        self, published_from: datetime, published_to: datetime, chunk: timedelta = timedelta(days=7)
    ) -> pd.DataFrame:
        """Every forecast run published in ``[published_from, published_to)`` (UTC)."""
        rows: list[dict[str, Any]] = []
        start = published_from
        while start < published_to:
            end = min(start + chunk, published_to)
            rows += self._get(
                "/datasets/WINDFOR/stream",
                {"publishDateTimeFrom": _iso_utc(start), "publishDateTimeTo": _iso_utc(end)},
            )
            start = end
        frame = normalise_forecasts(rows)
        in_window = (frame["publish_time"] >= published_from) & (frame["publish_time"] < published_to)
        return frame[in_window].reset_index(drop=True)

    def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._http.get(path, params=params)
                if response.status_code == 429 or response.status_code >= 500:
                    raise ElexonError(f"HTTP {response.status_code} from {path}")
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, list):
                    raise ElexonError(f"Unexpected payload from {path}: {type(payload).__name__}")
                log.info("GET %s %s -> %d rows", path, params, len(payload))
                return payload
            except (httpx.TransportError, ElexonError) as exc:
                if attempt == self._max_attempts:
                    raise ElexonError(f"Elexon request failed after {attempt} attempts: {exc}") from exc
                backoff_s = 2**attempt
                log.warning("Elexon request failed (%s); retrying in %ss", exc, backoff_s)
                clock.sleep(backoff_s)
        raise AssertionError("unreachable")


def normalise_actuals(rows: list[dict[str, Any]]) -> pd.DataFrame:
    """Tidy FUELHH rows: wind only, one row per half-hour (latest publication wins)."""
    raw = pd.DataFrame(rows)
    if raw.empty:
        return _empty(ACTUAL_COLUMNS)
    raw = raw[raw["fuelType"] == "WIND"]
    frame = pd.DataFrame(
        {
            "start_time": pd.to_datetime(raw["startTime"], utc=True),
            "settlement_date": raw["settlementDate"].astype(str),
            "settlement_period": raw["settlementPeriod"].astype(int),
            "generation_mw": pd.to_numeric(raw["generation"], errors="coerce"),
            "publish_time": pd.to_datetime(raw["publishTime"], utc=True),
        }
    )
    return (
        frame.dropna(subset=["generation_mw"])
        .sort_values(["start_time", "publish_time"])
        .drop_duplicates("start_time", keep="last")
        .reset_index(drop=True)
    )


def normalise_forecasts(rows: list[dict[str, Any]]) -> pd.DataFrame:
    """Tidy WINDFOR rows: one row per (run, target hour)."""
    raw = pd.DataFrame(rows)
    if raw.empty:
        return _empty(FORECAST_COLUMNS)
    frame = pd.DataFrame(
        {
            "publish_time": pd.to_datetime(raw["publishTime"], utc=True),
            "start_time": pd.to_datetime(raw["startTime"], utc=True),
            "generation_mw": pd.to_numeric(raw["generation"], errors="coerce"),
        }
    )
    return (
        frame.dropna(subset=["generation_mw"])
        .drop_duplicates(["publish_time", "start_time"], keep="last")
        .sort_values(["publish_time", "start_time"])
        .reset_index(drop=True)
    )


def _empty(columns: list[str]) -> pd.DataFrame:
    frame = pd.DataFrame({c: pd.Series(dtype="float64") for c in columns})
    for c in ("start_time", "publish_time"):
        if c in frame:
            frame[c] = pd.to_datetime(frame[c], utc=True)
    return frame


def _iso_utc(value: datetime) -> str:
    return pd.Timestamp(value).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
