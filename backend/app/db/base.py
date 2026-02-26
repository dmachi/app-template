from typing import Protocol


class DatabaseAdapter(Protocol):
    provider_name: str

    def connect(self) -> None:
        ...

    def ping(self) -> bool:
        ...

    def close(self) -> None:
        ...
