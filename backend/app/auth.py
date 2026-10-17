"""
API Key Authentication Dependency (`backend/app/auth.py`)
Enforces `X-API-Key` header validation per Case Section 10 specification.
"""

from typing import Optional
from fastapi import Header, Query, HTTPException, status
from backend.app.config import settings


async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    q_api_key: Optional[str] = Query(None, alias="api_key"),
) -> str:
    """
    Validates the `X-API-Key` header (or query param fallback) on protected endpoints.
    Accepts configured `settings.API_KEY` as well as the standard datathon secret keys.
    Returns 401 Unauthorized if missing or invalid.
    """
    key = x_api_key or q_api_key
    valid_keys = {
        settings.API_KEY,
        "fortebank-datathon-2026-secret-key",
        "fortebank-secret-key-2026",
    }

    if not key or key not in valid_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header.",
        )
    return key
