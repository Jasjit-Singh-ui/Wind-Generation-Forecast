"""HTTP routes. Handlers only validate input and delegate to :class:`~app.analytics.Analytics`."""

from __future__ import annotations

from datetime import date, time
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from . import schemas, settings
from .analytics import DEFAULT_COVERAGE, Analytics, OutOfScopeError
from .repository import load_data
from .timeutils import format_hhmm, parse_hhmm

router = APIRouter(prefix="/api")


@lru_cache(maxsize=1)
def get_analytics() -> Analytics:
    """App-wide analytics service over the loaded data (overridden in tests)."""
    return Analytics(load_data())


def decision_time_param(
    decision_time: Annotated[
        str,
        Query(
            pattern=r"^([01]\d|2[0-3]):[0-5]\d$",
            description="Decision time on D-1, UK local time (HH:MM). Defaults to the first gate closure.",
        ),
    ] = format_hhmm(settings.DEFAULT_DECISION_TIME),
) -> time:
    return parse_hhmm(decision_time)


def coverage_param(
    coverage: Annotated[int, Query(description="Central prediction interval width in %.")] = DEFAULT_COVERAGE,
) -> int:
    if coverage not in settings.SUPPORTED_COVERAGES:
        raise HTTPException(status_code=422, detail=f"coverage must be one of {list(settings.SUPPORTED_COVERAGES)}")
    return coverage


AnalyticsDep = Annotated[Analytics, Depends(get_analytics)]
DecisionTime = Annotated[time, Depends(decision_time_param)]
Coverage = Annotated[int, Depends(coverage_param)]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/meta", response_model=schemas.Meta)
def meta(analytics: AnalyticsDep) -> schemas.Meta:
    """Scope of the pilot, decision presets and data coverage."""
    return analytics.meta()


@router.get("/day-ahead", response_model=schemas.DayAhead)
def day_ahead(
    analytics: AnalyticsDep,
    decision_time: DecisionTime,
    coverage: Coverage,
    delivery_date: Annotated[date, Query(alias="date", description="Delivery day (UK), YYYY-MM-DD.")],
) -> schemas.DayAhead:
    """What the desk could see at the decision for one delivery day, and what happened."""
    try:
        return analytics.day_ahead(delivery_date, decision_time, coverage)
    except OutOfScopeError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/accuracy", response_model=schemas.Accuracy)
def accuracy(analytics: AnalyticsDep, decision_time: DecisionTime, coverage: Coverage) -> schemas.Accuracy:
    """Backtest of the decision-time forecast over every delivery day in scope."""
    return analytics.accuracy(decision_time, coverage)


@router.get("/horizon", response_model=schemas.Horizon)
def horizon(analytics: AnalyticsDep) -> schemas.Horizon:
    """Accuracy as a function of forecast lead time and of the decision time on D-1."""
    return analytics.horizon()
