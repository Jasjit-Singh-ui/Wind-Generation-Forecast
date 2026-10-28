from datetime import date, time

from app.forecasting import decision_forecasts, forecast_vintages, with_actuals
from tests.conftest import actuals_frame, forecasts_frame, ts

DELIVERY = date(2026, 1, 15)  # decision on 14 Jan


def test_uses_latest_run_published_strictly_before_the_cutoff():
    forecasts = forecasts_frame(
        [
            ("2026-01-14T04:30", "2026-01-15T12:00", 1_000),
            ("2026-01-14T07:30", "2026-01-15T12:00", 2_000),  # latest before 09:30
            ("2026-01-14T09:30", "2026-01-15T12:00", 3_000),  # published exactly at the cutoff
            ("2026-01-14T11:30", "2026-01-15T12:00", 4_000),  # after the cutoff
        ]
    )
    picked = decision_forecasts(forecasts, [DELIVERY], time(9, 30))
    assert picked["forecast_mw"].tolist() == [2_000]
    assert picked["publish_time"].tolist() == [ts("2026-01-14T07:30")]
    assert picked["lead_hours"].tolist() == [28.5]


def test_falls_back_per_hour_when_the_latest_run_does_not_cover_it():
    forecasts = forecasts_frame(
        [
            ("2026-01-13T22:30", "2026-01-15T22:00", 500),
            ("2026-01-13T22:30", "2026-01-15T23:00", 600),
            ("2026-01-14T07:30", "2026-01-15T22:00", 700),  # this run stops at 22:00
        ]
    )
    picked = decision_forecasts(forecasts, [DELIVERY], time(9, 20)).set_index("start_time")
    assert picked.loc[ts("2026-01-15T22:00"), "forecast_mw"] == 700
    assert picked.loc[ts("2026-01-15T23:00"), "forecast_mw"] == 600


def test_hours_without_any_earlier_forecast_are_absent():
    forecasts = forecasts_frame([("2026-01-14T11:30", "2026-01-15T12:00", 4_000)])
    assert decision_forecasts(forecasts, [DELIVERY], time(9, 20)).empty


def test_only_target_hours_inside_the_uk_delivery_day_are_selected():
    forecasts = forecasts_frame(
        [
            ("2026-01-14T07:30", "2026-01-14T23:00", 1),  # D-1
            ("2026-01-14T07:30", "2026-01-15T00:00", 2),  # first hour of D
            ("2026-01-14T07:30", "2026-01-15T23:00", 3),  # last hour of D
            ("2026-01-14T07:30", "2026-01-16T00:00", 4),  # D+1
        ]
    )
    picked = decision_forecasts(forecasts, [DELIVERY], time(9, 20))
    assert picked["forecast_mw"].tolist() == [2, 3]
    assert set(picked["delivery_date"]) == {DELIVERY}


def test_irregular_publish_times_are_handled():
    forecasts = forecasts_frame(
        [
            ("2026-01-14T09:30", "2026-01-15T12:00", 1_000),
            ("2026-01-14T12:25", "2026-01-15T12:00", 2_000),  # the 11:30 run was late
        ]
    )
    assert decision_forecasts(forecasts, [DELIVERY], time(12, 0))["forecast_mw"].tolist() == [1_000]
    assert decision_forecasts(forecasts, [DELIVERY], time(12, 30))["forecast_mw"].tolist() == [2_000]


def test_vintages_include_every_run_published_before_delivery_starts():
    forecasts = forecasts_frame(
        [
            ("2026-01-13T07:30", "2026-01-15T12:00", 1),
            ("2026-01-14T22:30", "2026-01-15T12:00", 2),
            ("2026-01-15T02:30", "2026-01-15T12:00", 3),  # published during delivery day
            ("2026-01-14T22:30", "2026-01-16T12:00", 4),  # targets the next day
        ]
    )
    vintages = forecast_vintages(forecasts, DELIVERY)
    assert vintages["generation_mw"].tolist() == [1, 2]


def test_actuals_are_matched_on_start_time():
    forecasts = forecasts_frame([("2026-01-14T07:30", "2026-01-15T12:00", 5_000)])
    actuals = actuals_frame({"2026-01-15T12:00": 4_000.0, "2026-01-15T12:30": 9_999.0})
    paired = with_actuals(decision_forecasts(forecasts, [DELIVERY], time(9, 20)), actuals)
    assert paired["actual_mw"].tolist() == [4_000.0]
