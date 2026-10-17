"""
API Key Authentication Dependency (`backend/app/auth.py`)
Enforces `X-API-Key` header validation per Case Section 10 specification.
"""

from typing import Optional
from fastapi import Header, HTTPException, status
from backend.app.config import settings


async def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> str:
    """
    Validates the `X-API-Key` header on protected endpoints.
    Returns 401 Unauthorized if missing or invalid.
    """
    if not x_api_key or x_api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header.",
        )
    return x_api_key
