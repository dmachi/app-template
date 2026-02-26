from app.core.config import Settings
from app.db.base import DatabaseAdapter
from app.db.mongo import MongoDatabaseAdapter


def create_database_adapter(settings: Settings) -> DatabaseAdapter:
    if settings.database_provider == "mongodb":
        return MongoDatabaseAdapter(settings.resolved_database_url, settings.resolved_database_name)

    raise NotImplementedError(f"Unsupported database provider: {settings.database_provider}")
