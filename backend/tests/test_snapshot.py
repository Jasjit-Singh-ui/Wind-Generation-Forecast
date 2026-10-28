"""Golden numbers on the bundled Elexon snapshot: guards the pipeline against regressions.

If the snapshot is deliberately refreshed and Elexon has revised data, update these values.
"""

from datetime import date, time

import pytest

from app import settings
from app.analytics import Analytics
from app.repository import load_snapshot

pytestmark = pytest.mark.skipif(
    not (settings.DATA_DIR / "wind_forecasts.csv").exists(), reason="data snapshot not present"
)


@pytest.fixture(scope="module")
def analytics():
    return Analytics(load_snapshot())


def test_snapshot_is_complete(analytics):
    meta = analytics.meta()
    assert meta.data.missing_periods == 0
    assert meta.data.forecast_runs == 376
    assert [r.isoformat() for r in meta.data.off_schedule_runs] == ["2026-01-15T12:25:00+00:00"]


def test_headline_accuracy_at_the_default_decision_time(analytics):
    result = analytics.accuracy(time(9, 20), 80)
    assert result.period.hours == 744
    assert result.period.lead_hours_min == 16.5 and result.period.lead_hours_max == 39.5
    assert result.official.mae_mw == pytest.approx(2022.5, abs=0.1)
    assert result.official.bias_mw == pytest.approx(1745.9, abs=0.1)
    assert result.adjusted.mae_mw == pytest.approx(1419.9, abs=0.1)
    assert result.interval.coverage_pct == pytest.approx(82.0, abs=0.1)


def test_day_ahead_uses_the_0730_run_for_the_0920_decision(analytics):
    result = analytics.day_ahead(date(2026, 1, 16), time(9, 20))
    assert result.decision.latest_run.isoformat() == "2026-01-15T07:30:00+00:00"
    assert result.calibration is not None
    assert (result.calibration.window_start, result.calibration.window_end) == (date(2026, 1, 1), date(2026, 1, 14))


def test_waiting_for_later_runs_helps_less_than_adjusting(analytics):
    steps = {p.from_time: p for p in analytics.horizon().decision_times}
    assert "12:25" in steps  # the late 11:30 run on 15 Jan is a real step
    latest = steps["22:30"]
    assert steps["07:30"].mae_official_mw > latest.mae_official_mw  # fresher runs do help a little...
    assert steps["00:00"].mae_adjusted_mw < latest.mae_official_mw  # ...but adjusting helps more
