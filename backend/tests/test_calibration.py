from datetime import date, timedelta

import pandas as pd
import pytest

from app.calibration import apply_calibration, calibrate, calibration_window, quantile_levels

TARGET = date(2026, 1, 16)


def decisions(days: dict[date, tuple[float, float]], hours: int = 24) -> pd.DataFrame:
    """Hourly decision-time forecasts with actuals: ``{day: (forecast_mw, actual_mw)}``."""
    rows = []
    for day, (forecast, actual) in days.items():
        start = pd.Timestamp(day.isoformat(), tz="UTC")
        rows += [
            {
                "delivery_date": day,
                "start_time": start + timedelta(hours=h),
                "forecast_mw": forecast,
                "actual_mw": actual,
            }
            for h in range(hours)
        ]
    return pd.DataFrame(rows)


def test_window_ends_two_days_before_delivery():
    # Deciding on D-1, the last complete outturn day is D-2.
    assert calibration_window(TARGET, lookback_days=14) == (date(2026, 1, 1), date(2026, 1, 14))


def test_quantile_levels():
    assert quantile_levels(80) == pytest.approx((0.1, 0.5, 0.9))
    assert quantile_levels(90) == pytest.approx((0.05, 0.5, 0.95))
    with pytest.raises(ValueError):
        quantile_levels(100)


def test_constant_ratio_is_learned_exactly():
    history = {TARGET - timedelta(days=d): (10_000.0, 8_000.0) for d in range(2, 16)}
    frame = decisions(history | {TARGET: (5_000.0, None)})
    fitted = calibrate(frame, [TARGET], coverage=80, lookback_days=14)
    adjusted = apply_calibration(frame, fitted)
    assert fitted[TARGET].samples == 14 * 24
    assert adjusted["adjusted_mw"].tolist() == pytest.approx([4_000.0] * 24)
    assert adjusted["low_mw"].tolist() == pytest.approx([4_000.0] * 24)


def test_no_look_ahead_outturn_from_d_minus_1_onwards_is_ignored():
    history = {TARGET - timedelta(days=d): (10_000.0, 8_000.0) for d in range(2, 16)}
    leaky = {TARGET - timedelta(days=1): (10_000.0, 1.0), TARGET: (10_000.0, 1.0)}
    fitted = calibrate(decisions(history | leaky), [TARGET], coverage=80, lookback_days=14)
    assert fitted[TARGET].ratio_mid == pytest.approx(0.8)


def test_interval_is_ordered_and_spans_the_empirical_quantiles():
    ratios = [0.5 + 0.05 * i for i in range(14)]  # one ratio per history day
    history = {TARGET - timedelta(days=d + 2): (10_000.0, 10_000.0 * r) for d, r in enumerate(ratios)}
    fitted = calibrate(decisions(history), [TARGET], coverage=80, lookback_days=14)[TARGET]
    assert fitted.ratio_low < fitted.ratio_mid < fitted.ratio_high
    assert fitted.ratio_low == pytest.approx(pd.Series(ratios).repeat(24).quantile(0.1))


def test_too_little_history_gives_no_adjustment():
    frame = decisions({TARGET - timedelta(days=2): (10_000.0, 8_000.0)}, hours=24)
    fitted = calibrate(frame, [TARGET], coverage=80, lookback_days=14, min_samples=48)
    assert fitted[TARGET] is None
    assert apply_calibration(decisions({TARGET: (1.0, None)}), fitted)["adjusted_mw"].isna().all()


def test_tiny_forecasts_are_excluded_from_the_ratio_fit():
    history = {TARGET - timedelta(days=d): (10_000.0, 9_000.0) for d in range(2, 9)}
    history |= {TARGET - timedelta(days=d): (100.0, 900.0) for d in range(9, 16)}  # ratio 9.0
    fitted = calibrate(decisions(history), [TARGET], coverage=80, lookback_days=14, min_forecast_mw=500)
    assert fitted[TARGET].ratio_high == pytest.approx(0.9)
