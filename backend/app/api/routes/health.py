from fastapi import APIRouter, Request

from app.core.config import get_settings

router = APIRouter(tags=["system"])


@router.get("/health")
def health(request: Request) -> dict:
    settings = get_settings()
    database = request.app.state.database_adapter

    database_status = "ok" if database.ping() else "unavailable"
    app_status = "ok" if database_status == "ok" else "degraded"

    return {
        "status": app_status,
        "environment": settings.app_env,
        "database": {
            "provider": database.provider_name,
            "status": database_status,
        },
    }
