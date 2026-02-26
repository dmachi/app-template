from pymongo import MongoClient


class MongoDatabaseAdapter:
    provider_name = "mongodb"

    def __init__(self, uri: str, database_name: str) -> None:
        self._uri = uri
        self._database_name = database_name
        self._client: MongoClient | None = None

    def connect(self) -> None:
        self._client = MongoClient(self._uri)

    def ping(self) -> bool:
        if self._client is None:
            return False
        self._client.admin.command("ping")
        return True

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def get_collection(self, collection_name: str):
        if self._client is None:
            raise RuntimeError("Mongo client is not connected")
        return self._client[self._database_name][collection_name]
