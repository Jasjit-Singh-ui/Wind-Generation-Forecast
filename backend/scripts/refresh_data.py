"""Re-fetch the wind data snapshot from Elexon into backend/data.

Usage (from the backend directory):  python -m scripts.refresh_data
"""

from __future__ import annotations

import logging

from app import settings
from app.repository import fetch_from_elexon, fetch_window, save_snapshot


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    published_from, published_to = fetch_window()
    logging.info(
        "Fetching actuals for %s..%s and forecast runs published %s..%s",
        settings.DATA_FIRST_DELIVERY_DATE,
        settings.LAST_DELIVERY_DATE,
        published_from,
        published_to,
    )
    data = fetch_from_elexon()
    save_snapshot(data)
    logging.info(
        "Saved %d half-hourly actuals and %d forecast rows (%d runs) to %s",
        len(data.actuals),
        len(data.forecasts),
        data.forecasts["publish_time"].nunique(),
        settings.DATA_DIR,
    )


if __name__ == "__main__":
    main()
