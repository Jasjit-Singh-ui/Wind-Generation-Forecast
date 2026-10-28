import math
from datetime import date

import pandas as pd
import pytest

from app.metrics import (
    by_forecast_level,
    daily_breakdown,
    error_histogram,
    error_stats,
    interval_stats,
    lead_time_profile,
)
from tests.conftest import actuals_frame, ts


def test_error_stats_known_values():
    stats = error_stats(pd.Series([10.0, 20.0, 30.0]), pd.Series([8.0, 22.0, 30.0]))
    assert stats["n"] == 3
    assert stats["mae_mw"] == pytest.approx(4 / 3)
    assert stats["rmse_mw"] == pytest.approx(math.sqrt(8 / 3))
    assert stats["bias_mw"] == pytest.approx(0)
    assert stats["wape_pct"] == pytest.approx(100 * 4 / 60)
    assert stats["max_over_mw"] == 2 and stats["max_under_mw"] == -2
    assert stats["share_over_pct"] == pytest.approx(100 / 3)


def test_positive_error_means_wind_under_delivered():
    stats = error_stats(pd.Series([12_000.0]), pd.Series([10_000.0]))
    assert stats["bias_mw"] == 2_000


def test_error_stats_ignores_missing_pairs_and_handles_empty():
    assert error_stats(pd.Series([1.0, None]), pd.Series([None, 2.0]))["n"] == 0
    assert error_stats(pd.Series([1.0, 5.0]), pd.Series([None, 2.0]))["mae_mw"] == 3


def test_interval_stats():
    stats = interval_stats(pd.Series([0.0, 0.0, 0.0, 0.0]), pd.Series([10.0] * 4), pd.Series([-1.0, 5.0, 10.0, 11.0]))
    assert stats["coverage_pct"] == 50
    assert stats["below_pct"] == 25 and stats["above_pct"] == 25
    assert stats["mean_width_mw"] == 10


def test_daily_energy_uses_one_hour_per_forecast_and_half_an_hour_per_outturn():
    day = date(2026, 1, 15)
    hourly = pd.DataFrame(
        {
            "delivery_date": [day, day],
            "start_time": [ts("2026-01-15T00:00"), ts("2026-01-15T01:00")],
            "forecast_mw": [1_000.0, 3_000.0],
            "adjusted_mw": [900.0, 2_700.0],
            "actual_mw": [800.0, 2_000.0],
        }
    )
    actuals = actuals_frame(
        {
            "2026-01-15T00:00": 800.0,
            "2026-01-15T00:30": 1_200.0,
            "2026-01-15T01:00": 2_000.0,
            "2026-01-15T01:30": 2_000.0,
        }
    )
    row = daily_breakdown(hourly, actuals).iloc[0]
    assert row["forecast_mwh"] == 4_000
    assert row["adjusted_mwh"] == 3_600
    assert row["actual_mwh"] == 3_000
    assert row["mae_official_mw"] == pytest.approx(600)


def test_forecast_level_bins_are_left_closed():
    hourly = pd.DataFrame(
        {"forecast_mw": [3_999.0, 4_000.0, 20_000.0], "adjusted_mw": [1.0, 1.0, 1.0], "actual_mw": [0.0, 0.0, 0.0]}
    )
    table = by_forecast_level(hourly)
    assert table["level_from_mw"].tolist() == [0, 4_000, 16_000]
    assert math.isnan(table["level_to_mw"].iloc[-1])  # open-ended top bin
    assert table["n"].tolist() == [1, 1, 1]


def test_histogram_counts_every_error_once():
    errors = pd.Series([-1_200.0, -10.0, 0.0, 499.0, 500.0, 2_600.0])
    table = error_histogram({"official": errors, "adjusted": errors / 2}, bin_width_mw=500)
    assert table["official"].sum() == len(errors)
    assert table["adjusted"].sum() == len(errors)
    assert table["bin_from_mw"].iloc[0] == -1_500


def test_lead_time_profile_bins_and_drops_hindcasts():
    paired = pd.DataFrame(
        {
            "publish_time": [ts("2026-01-15T00:00")] * 3,
            "start_time": [ts("2026-01-14T23:00"), ts("2026-01-15T01:00"), ts("2026-01-15T04:00")],
            "generation_mw": [100.0, 110.0, 130.0],
            "actual_mw": [100.0, 100.0, 100.0],
        }
    )
    profile = lead_time_profile(paired, bin_hours=3)
    assert profile["lead_from_h"].tolist() == [0, 3]
    assert profile["bias_mw"].tolist() == [10, 30]
