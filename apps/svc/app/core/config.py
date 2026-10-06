import os
from pathlib import Path

from dotenv import load_dotenv

# Load apps/svc/.env once (values already in the environment win).
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def get_internal_key() -> str:
    """Shared secret the API sends in X-Internal-Key. Read on every call so tests can change it."""
    return os.environ.get("SVC_INTERNAL_KEY", "").strip()
