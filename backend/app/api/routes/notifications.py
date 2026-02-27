from datetime import UTC, datetime
from typing import Any

import jwt
from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, require_superuser
from app.auth.security import decode_access_token
from app.auth.store import NotificationRecord, UserRecord
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.notifications.redis_bus import RedisEventBus

router = APIRouter(prefix="/notifications", tags=["notifications"])
admin_router = APIRouter(prefix="/admin/notifications", tags=["admin-notifications"])
ws_router = APIRouter(tags=["ws"])


class NotificationCreateRequest(BaseModel):
    userIds: list[str] = Field(min_length=1)
    type: str = Field(min_length=1)
    message: str = Field(min_length=1)
    severity: str = "info"
    requiresAcknowledgement: bool = False
    clearanceMode: str = "manual"
    source: dict[str, Any] | None = None
    openEndpoint: str | None = None
    deliveryOptions: dict[str, Any] | None = None
    completionCheck: dict[str, Any] | None = None


class NotificationFilterQuery(BaseModel):
    status: str | None = None
    type: str | None = None


class NotificationRealtimeHub:
    def __init__(self, redis_bus: RedisEventBus | None = None) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._redis_bus = redis_bus
        self._redis_handlers: dict[str, Any] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)

        if self._redis_bus and user_id not in self._redis_handlers:
            async def redis_handler(event_type: str, payload: dict[str, Any]) -> None:
                envelope = {
                    "eventType": event_type,
                    "eventId": f"evt_{datetime.now(UTC).timestamp()}",
                    "timestamp": datetime.now(UTC).isoformat(),
                    "payload": payload,
                }
                conns = list(self._connections.get(user_id, set()))
                stale: list[WebSocket] = []
                for ws in conns:
                    try:
                        await ws.send_json(envelope)
                    except Exception:
                        stale.append(ws)
                for ws in stale:
                    self.disconnect(user_id, ws)

            self._redis_handlers[user_id] = redis_handler
            await self._redis_bus.subscribe(user_id, redis_handler)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(user_id)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            self._connections.pop(user_id, None)

    def is_user_connected(self, user_id: str) -> bool:
        conns = self._connections.get(user_id)
        return bool(conns)

    async def publish(self, user_id: str, event_type: str, payload: dict[str, Any]) -> None:
        if self._redis_bus:
            await self._redis_bus.publish(user_id, event_type, payload)
        else:
            conns = list(self._connections.get(user_id, set()))
            if not conns:
                return
            envelope = {
                "eventType": event_type,
                "eventId": f"evt_{datetime.now(UTC).timestamp()}",
                "timestamp": datetime.now(UTC).isoformat(),
                "payload": payload,
            }
            stale: list[WebSocket] = []
            for websocket in conns:
                try:
                    await websocket.send_json(envelope)
                except Exception:
                    stale.append(websocket)
            for websocket in stale:
                self.disconnect(user_id, websocket)


def _get_hub(request: Request) -> NotificationRealtimeHub:
    hub = getattr(request.app.state, "notification_realtime_hub", None)
    if hub is None:
        hub = NotificationRealtimeHub()
        request.app.state.notification_realtime_hub = hub
    return hub


def _serialize_notification(record: NotificationRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "userId": record.user_id,
        "type": record.type,
        "message": record.message,
        "severity": record.severity,
        "requiresAcknowledgement": record.requires_acknowledgement,
        "clearanceMode": record.clearance_mode,
        "source": record.source,
        "openEndpoint": record.open_endpoint,
        "deliveryOptions": record.delivery_options,
        "completionCheck": record.completion_check,
        "status": record.status,
        "mergeCount": record.merge_count,
        "readAt": record.read_at.isoformat() if record.read_at else None,
        "acknowledgedAt": record.acknowledged_at.isoformat() if record.acknowledged_at else None,
        "clearedAt": record.cleared_at.isoformat() if record.cleared_at else None,
        "canceledAt": record.canceled_at.isoformat() if record.canceled_at else None,
        "completionSatisfiedAt": record.completion_satisfied_at.isoformat() if record.completion_satisfied_at else None,
        "createdAt": record.created_at.isoformat(),
        "updatedAt": record.updated_at.isoformat(),
    }


def _purge_expired_notifications(request: Request) -> None:
    auth_store = request.app.state.auth_store
    settings: Settings = request.app.state.settings
    purge = getattr(auth_store, "purge_completed_notifications", None)
    if callable(purge):
        purge(settings.notifications_completed_retention_hours)


async def _publish_notification_event(request: Request, event_type: str, record: NotificationRecord) -> None:
    hub = _get_hub(request)
    await hub.publish(record.user_id, event_type, _serialize_notification(record))


@router.post("")
async def create_notifications(
    payload: NotificationCreateRequest,
    request: Request,
    _: UserRecord = Depends(require_superuser),
) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    created: list[dict[str, Any]] = []
    merged: list[dict[str, Any]] = []

    for user_id in list(dict.fromkeys(payload.userIds)):
        try:
            record, is_created = auth_store.create_or_merge_notification(
                user_id=user_id,
                type_name=payload.type,
                message=payload.message,
                severity=payload.severity,
                requires_acknowledgement=payload.requiresAcknowledgement,
                clearance_mode=payload.clearanceMode,
                source=payload.source,
                open_endpoint=payload.openEndpoint,
                delivery_options=payload.deliveryOptions,
                completion_check=payload.completionCheck,
            )
        except ValueError as exc:
            if str(exc) == "USER_NOT_FOUND":
                raise ApiError(status_code=404, code="USER_NOT_FOUND", message=f"User not found: {user_id}") from exc
            raise

        serialized = _serialize_notification(record)
        if is_created:
            created.append(serialized)
            await _publish_notification_event(request, "notification.created", record)
        else:
            merged.append(serialized)
            await _publish_notification_event(request, "notification.updated", record)

    return {"created": created, "merged": merged}


@router.get("")
def list_my_notifications(
    request: Request,
    status: str | None = Query(default=None),
    type: str | None = Query(default=None),
    unreadOnly: bool | None = Query(default=None),
    current_user: UserRecord = Depends(get_current_user),
) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    items = auth_store.list_notifications_for_user(user_id=current_user.id, status=status, type_name=type)
    default_active_only = unreadOnly is None and status is None
    if unreadOnly is True or default_active_only:
        items = [item for item in items if item.status == "unread"]
    return {"items": [_serialize_notification(item) for item in items]}


@router.get("/{notification_id}")
def get_my_notification(notification_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item = auth_store.get_notification(notification_id)
    if item is None or item.user_id != current_user.id:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    return _serialize_notification(item)


@router.post("/{notification_id}/read")
async def read_my_notification(notification_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item = auth_store.mark_notification_read(notification_id, user_id=current_user.id)
    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    await _publish_notification_event(request, "notification.updated", item)
    return _serialize_notification(item)


@router.post("/{notification_id}/acknowledge")
async def acknowledge_my_notification(notification_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item = auth_store.acknowledge_notification(notification_id, user_id=current_user.id)
    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    await _publish_notification_event(request, "notification.updated", item)
    return _serialize_notification(item)


@router.post("/{notification_id}/check-completion")
async def check_my_notification_completion(notification_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item, completed = auth_store.evaluate_notification_completion(notification_id, user_id=current_user.id)
    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    await _publish_notification_event(request, "notification.check.completed", item)
    return {"completed": completed, "notification": _serialize_notification(item)}


@router.post("/{notification_id}/clear")
async def clear_my_notification(notification_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    try:
        item = auth_store.clear_notification(notification_id, user_id=current_user.id)
    except ValueError as exc:
        if str(exc) == "ACK_REQUIRED":
            raise ApiError(status_code=400, code="ACK_REQUIRED", message="Notification must be acknowledged before clearing") from exc
        if str(exc) == "TASK_NOT_COMPLETED":
            raise ApiError(status_code=400, code="TASK_NOT_COMPLETED", message="Task-gated notification is not complete") from exc
        raise

    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    await _publish_notification_event(request, "notification.cleared", item)
    return _serialize_notification(item)


@router.get("/{notification_id}/open")
async def open_my_notification(notification_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)):
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item = auth_store.mark_notification_read(notification_id, user_id=current_user.id)
    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")

    if item.clearance_mode == "ack":
        item = auth_store.acknowledge_notification(notification_id, user_id=current_user.id) or item
        item = auth_store.clear_notification(notification_id, user_id=current_user.id) or item

    await _publish_notification_event(request, "notification.updated", item)
    destination = item.open_endpoint or "/settings/profile"
    return RedirectResponse(url=destination, status_code=307)


@admin_router.get("")
def admin_list_notifications(
    request: Request,
    status: str | None = Query(default=None),
    type: str | None = Query(default=None),
    userId: str | None = Query(default=None),
    _: UserRecord = Depends(require_superuser),
) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    items = auth_store.list_notifications(status=status, type_name=type, user_id=userId)
    return {"items": [_serialize_notification(item) for item in items]}


@admin_router.get("/{notification_id}")
def admin_get_notification(notification_id: str, request: Request, _: UserRecord = Depends(require_superuser)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item = auth_store.get_notification(notification_id)
    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    return _serialize_notification(item)


@admin_router.post("/{notification_id}/resend")
async def admin_resend_notification(notification_id: str, request: Request, _: UserRecord = Depends(require_superuser)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item = auth_store.get_notification(notification_id)
    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    await _publish_notification_event(request, "notification.updated", item)
    return {"success": True, "notification": _serialize_notification(item)}


@admin_router.post("/{notification_id}/cancel")
async def admin_cancel_notification(notification_id: str, request: Request, _: UserRecord = Depends(require_superuser)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    item = auth_store.cancel_notification(notification_id)
    if item is None:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    await _publish_notification_event(request, "notification.cleared", item)
    return {"success": True, "notification": _serialize_notification(item)}


@admin_router.delete("/{notification_id}")
def admin_delete_notification(notification_id: str, request: Request, _: UserRecord = Depends(require_superuser)) -> dict[str, Any]:
    auth_store = request.app.state.auth_store
    _purge_expired_notifications(request)
    deleted = auth_store.delete_notification(notification_id)
    if not deleted:
        raise ApiError(status_code=404, code="NOTIFICATION_NOT_FOUND", message="Notification not found")
    return {"success": True}


@ws_router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket, token: str = Query(default=""), settings: Settings = Depends(get_settings)):
    if not token:
        await websocket.close(code=4401)
        return

    try:
        payload = decode_access_token(token, settings)
    except jwt.InvalidTokenError:
        await websocket.close(code=4401)
        return

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        await websocket.close(code=4401)
        return

    auth_store = websocket.app.state.auth_store
    user = auth_store.get_user(user_id)
    if user is None or user.status != "active":
        await websocket.close(code=4403)
        return

    hub = getattr(websocket.app.state, "notification_realtime_hub", None)
    if hub is None:
        hub = NotificationRealtimeHub()
        websocket.app.state.notification_realtime_hub = hub

    await hub.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(user_id, websocket)
