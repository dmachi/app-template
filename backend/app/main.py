from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import router as api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.factory import create_database_adapter


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    database_adapter = create_database_adapter(settings)
    database_adapter.connect()

    app.state.database_adapter = database_adapter
    yield

    database_adapter.close()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.include_router(api_router, prefix=settings.api_prefix)
    register_error_handlers(app)

    return app


app = create_app()
