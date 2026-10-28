"""FastAPI application: JSON API under /api plus, when built, the React single-page app."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import settings
from .api import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# The data is a historical snapshot, so API responses can be cached by browsers and CDNs
# (but never the health check, which must reflect the live process).
API_CACHE_CONTROL = "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400"
UNCACHED_PATHS = {"/api/health"}


def create_app() -> FastAPI:
    app = FastAPI(
        title="Day-ahead wind forecast monitor",
        version="1.0.0",
        description="Decision-time GB wind forecasts and their accuracy (Elexon BMRS FUELHH & WINDFOR).",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])

    @app.middleware("http")
    async def cache_api_responses(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/api/") and request.method == "GET" and response.status_code == 200:
            response.headers.setdefault("Cache-Control", "no-store" if path in UNCACHED_PATHS else API_CACHE_CONTROL)
        return response

    app.include_router(router)
    # The React build: API routes always take priority, other navigations fall back to
    # index.html. On Vercel these files are promoted to the CDN at build time.
    if (settings.STATIC_DIR / "index.html").exists():
        app.frontend("/", directory=settings.STATIC_DIR, fallback="index.html")
    return app


app = create_app()
