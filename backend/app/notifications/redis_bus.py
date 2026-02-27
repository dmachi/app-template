import asyncio
import json
from typing import Any

import redis.asyncio as redis


class RedisEventBus:
    def __init__(self, redis_url: str, channel_prefix: str = "notifications") -> None:
        self._redis_url = redis_url
        self._channel_prefix = channel_prefix
        self._client: redis.Redis | None = None
        self._pubsub: redis.client.PubSub | None = None
        self._listener_task: asyncio.Task | None = None
        self._subscribers: dict[str, set[Any]] = {}

    async def connect(self) -> None:
        if self._client is None:
            self._client = await redis.from_url(self._redis_url, decode_responses=True)
            self._pubsub = self._client.pubsub()

    async def disconnect(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._pubsub:
            await self._pubsub.aclose()
        if self._client:
            await self._client.aclose()
        self._client = None
        self._pubsub = None
        self._listener_task = None

    def _channel_name(self, user_id: str) -> str:
        return f"{self._channel_prefix}:{user_id}"

    async def subscribe(self, user_id: str, handler: Any) -> None:
        if self._pubsub is None:
            raise RuntimeError("RedisEventBus not connected")

        channel = self._channel_name(user_id)
        if channel not in self._subscribers:
            self._subscribers[channel] = set()
            await self._pubsub.subscribe(channel)
            if self._listener_task is None:
                self._listener_task = asyncio.create_task(self._listen())

        self._subscribers[channel].add(handler)

    async def unsubscribe(self, user_id: str, handler: Any) -> None:
        if self._pubsub is None:
            return

        channel = self._channel_name(user_id)
        handlers = self._subscribers.get(channel)
        if not handlers:
            return

        handlers.discard(handler)
        if not handlers:
            del self._subscribers[channel]
            await self._pubsub.unsubscribe(channel)

    async def publish(self, user_id: str, event_type: str, payload: dict[str, Any]) -> None:
        if self._client is None:
            raise RuntimeError("RedisEventBus not connected")

        channel = self._channel_name(user_id)
        message = json.dumps({"eventType": event_type, "payload": payload})
        await self._client.publish(channel, message)

    async def _listen(self) -> None:
        if self._pubsub is None:
            return

        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue

                channel = message["channel"]
                handlers = self._subscribers.get(channel, set())
                if not handlers:
                    continue

                try:
                    data = json.loads(message["data"])
                    event_type = data.get("eventType")
                    payload = data.get("payload")
                    for handler in list(handlers):
                        try:
                            await handler(event_type, payload)
                        except Exception:
                            pass
                except (json.JSONDecodeError, KeyError):
                    pass
        except asyncio.CancelledError:
            pass
