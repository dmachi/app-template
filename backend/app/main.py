import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as api_router
from app.auth.middleware import resolve_auth_context
from app.auth.mongo_store import MongoAuthStore
from app.auth.store import AuthStore
from app.cms.mongo_store import MongoCmsStore
from app.cms.store import InMemoryCmsStore
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.factory import create_database_adapter
from app.media.mongo_store import MongoMediaStore
from app.media.store import InMemoryMediaStore
from app.notifications.email import create_mail_sender
from app.notifications.redis_bus import RedisEventBus
from app.api.routes.notifications import NotificationRealtimeHub


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    database_adapter = create_database_adapter(settings)
    database_adapter.connect()

    redis_bus: RedisEventBus | None = None
    if settings.app_env != "test":
        redis_bus = RedisEventBus(settings.redis_url, settings.redis_notification_channel)
        try:
            await redis_bus.connect()
        except Exception:
            redis_bus = None

    app.state.database_adapter = database_adapter
    app.state.settings = settings
    app.state.mail_sender = create_mail_sender(settings)
    app.state.redis_bus = redis_bus
    app.state.notification_realtime_hub = NotificationRealtimeHub(redis_bus)
    if settings.app_env == "test" or os.getenv("PYTEST_CURRENT_TEST"):
        app.state.auth_store = AuthStore()
        app.state.cms_store = InMemoryCmsStore()
        app.state.media_store = InMemoryMediaStore()
    else:
        app.state.auth_store = MongoAuthStore(database_adapter)
        app.state.cms_store = MongoCmsStore(database_adapter)
        app.state.media_store = MongoMediaStore(database_adapter)
    yield

    if redis_bus:
        await redis_bus.disconnect()
    database_adapter.close()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def auth_context_middleware(request: Request, call_next):
        request.state.auth_context = resolve_auth_context(request, settings)
        return await call_next(request)

    app.include_router(api_router, prefix=settings.api_prefix)
    register_error_handlers(app)

    return app


app = create_app()
