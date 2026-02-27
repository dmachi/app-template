import asyncio

import pytest

from app.notifications.redis_bus import RedisEventBus


@pytest.mark.asyncio
async def test_redis_event_bus_pubsub():
    bus1 = RedisEventBus("redis://localhost:6379", "test_notifications")
    bus2 = RedisEventBus("redis://localhost:6379", "test_notifications")

    try:
        await bus1.connect()
        await bus2.connect()

        received_events = []

        async def handler(event_type: str, payload: dict) -> None:
            received_events.append({"type": event_type, "payload": payload})

        await bus2.subscribe("user123", handler)
        await asyncio.sleep(0.1)

        await bus1.publish("user123", "notification.created", {"id": "notif1", "message": "Test notification"})
        await asyncio.sleep(0.2)

        assert len(received_events) == 1
        assert received_events[0]["type"] == "notification.created"
        assert received_events[0]["payload"]["id"] == "notif1"

        await bus1.publish("user123", "notification.updated", {"id": "notif1", "message": "Updated"})
        await asyncio.sleep(0.2)

        assert len(received_events) == 2
        assert received_events[1]["type"] == "notification.updated"

        await bus2.unsubscribe("user123", handler)
    finally:
        await bus1.disconnect()
        await bus2.disconnect()


@pytest.mark.asyncio
async def test_redis_event_bus_multiple_subscribers():
    bus = RedisEventBus("redis://localhost:6379", "test_notifications")

    try:
        await bus.connect()

        received_1 = []
        received_2 = []

        async def handler1(event_type: str, payload: dict) -> None:
            received_1.append(event_type)

        async def handler2(event_type: str, payload: dict) -> None:
            received_2.append(event_type)

        await bus.subscribe("user456", handler1)
        await bus.subscribe("user456", handler2)
        await asyncio.sleep(0.1)

        await bus.publish("user456", "test.event", {"data": "test"})
        await asyncio.sleep(0.2)

        assert len(received_1) == 1
        assert len(received_2) == 1

        await bus.unsubscribe("user456", handler1)
        await bus.unsubscribe("user456", handler2)
    finally:
        await bus.disconnect()
