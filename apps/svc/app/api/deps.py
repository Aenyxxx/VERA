import secrets

from fastapi import Header, HTTPException

from app.core.config import get_internal_key


def require_internal_key(x_internal_key: str | None = Header(None)):
    """Only the VERA API may call the svc. Fails closed when no key is configured."""
    expected = get_internal_key()

    if not expected:
        raise HTTPException(status_code=503, detail="svc internal key is not configured")

    if not x_internal_key or not secrets.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=401, detail="invalid internal key")
