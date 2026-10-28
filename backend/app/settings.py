"""Application configuration.

Everything that defines *what* the app analyses lives here, so the scope of the pilot
(purchase decisions made in January 2026) is explicit and easy to change.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, time, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


@dataclass(frozen=True)
class DecisionPreset:
    """A named decision time on D-1 (UK local time), e.g. an auction gate closure."""

    id: str
    label: str
    time: time
    description: str


# GB day-ahead auction gate closures (UK local time, on the day before delivery).
DECISION_PRESETS: tuple[DecisionPreset, ...] = (
    DecisionPreset(
        id="epex-60",
        label="EPEX GB day-ahead (hourly)",
        time=time(9, 20),
        description="Gate closure of the EPEX SPOT GB 60-minute day-ahead auction.",
    ),
    DecisionPreset(
        id="n2ex",
        label="N2EX GB day-ahead (hourly)",
        time=time(9, 50),
        description="Gate closure of the Nord Pool N2EX GB day-ahead auction.",
    ),
    DecisionPreset(
        id="epex-30",
        label="EPEX GB day-ahead (half-hourly)",
        time=time(15, 30),
        description="Gate closure of the EPEX SPOT GB 30-minute day-ahead auction.",
    ),
)
DEFAULT_DECISION_TIME = DECISION_PRESETS[0].time

# Scope: purchase decisions made on these (UK) days. Each decision buys for the next day.
FIRST_DECISION_DATE = date(2026, 1, 1)
LAST_DECISION_DATE = date(2026, 1, 31)
FIRST_DELIVERY_DATE = FIRST_DECISION_DATE + timedelta(days=1)
LAST_DELIVERY_DATE = LAST_DECISION_DATE + timedelta(days=1)

# Error-adjusted forecast: calibrate on the decision-time forecast errors of the trailing
# N complete delivery days that are known when the decision is taken (see calibration.py).
CALIBRATION_LOOKBACK_DAYS = 14
# Hours with a forecast below this are ignored when estimating actual/forecast ratios,
# because ratios explode as the forecast approaches zero.
CALIBRATION_MIN_FORECAST_MW = 500.0
# Minimum hourly samples needed before an adjusted forecast is produced (2 days).
CALIBRATION_MIN_SAMPLES = 48
SUPPORTED_COVERAGES = (80, 90)  # central prediction interval widths, in %

# Data window that has to be fetched to support the scope above:
#  - actuals for every delivery day, plus the calibration history before the first one;
#  - every forecast run that could be the "latest available" for those days.
DATA_FIRST_DELIVERY_DATE = FIRST_DELIVERY_DATE - timedelta(days=CALIBRATION_LOOKBACK_DAYS + 1)
DATA_FIRST_PUBLISH_DATE = DATA_FIRST_DELIVERY_DATE - timedelta(days=2)
DATA_LAST_PUBLISH_DATE = LAST_DECISION_DATE  # inclusive (UK local day)

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")
ELEXON_TIMEOUT_S = float(os.getenv("ELEXON_TIMEOUT_S", "60"))

# "snapshot" (default) reads the CSVs in backend/data; "elexon" fetches live on first use.
DATA_SOURCE = os.getenv("DATA_SOURCE", "snapshot").lower()
DATA_DIR = Path(os.getenv("DATA_DIR", str(BACKEND_DIR / "data")))
STATIC_DIR = Path(os.getenv("STATIC_DIR", str(REPO_DIR / "frontend" / "dist")))
CORS_ORIGINS = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
