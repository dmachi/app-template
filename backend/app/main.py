import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as api_router
from app.auth.middleware import resolve_auth_context
from app.auth.mongo_store import MongoAuthStore
from app.auth.store import AuthStore
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.factory import create_database_adapter


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    database_adapter = create_database_adapter(settings)
    database_adapter.connect()

    app.state.database_adapter = database_adapter
    if settings.app_env == "test" or os.getenv("PYTEST_CURRENT_TEST"):
        app.state.auth_store = AuthStore()
    else:
        app.state.auth_store = MongoAuthStore(database_adapter)
    yield

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
