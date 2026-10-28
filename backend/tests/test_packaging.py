"""The Vercel manifest (root pyproject.toml) must pin the same runtime dependencies as the backend."""

import tomllib

from app import settings


def pinned(path):
    lines = (line.strip() for line in path.read_text("utf-8").splitlines())
    return sorted(line for line in lines if line and not line.startswith(("#", "-")))


def test_vercel_manifest_matches_backend_requirements():
    manifest = tomllib.loads((settings.REPO_DIR / "pyproject.toml").read_text("utf-8"))
    assert sorted(manifest["project"]["dependencies"]) == pinned(settings.BACKEND_DIR / "requirements.txt")
    assert manifest["tool"]["vercel"]["entrypoint"] == "backend.app.main:app"
