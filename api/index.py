"""Vercel entry point: the FastAPI app as a Python serverless function.

Vercel serves the React build (frontend/dist) as static files and routes /api/* here
(see vercel.json). The data snapshot in backend/data is bundled with the function.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402

__all__ = ["app"]
