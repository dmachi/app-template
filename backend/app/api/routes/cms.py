from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel, Field
from starlette.responses import Response

from app.auth.dependencies import get_current_user, require_superuser
from app.auth.roles import ROLE_CONTENT_EDITOR, ROLE_SUPERUSER, has_any_role
from app.auth.store import UserRecord
from app.cms.store import CONTENT_STATUS_PUBLISHED, CONTENT_VISIBILITY_AUTHENTICATED, CONTENT_VISIBILITY_PUBLIC, CONTENT_VISIBILITY_ROLES, normalize_alias_path
from app.core.errors import ApiError

router = APIRouter(tags=["cms"])
admin_router = APIRouter(prefix="/admin", tags=["cms-admin"])


class ContentTypeCreateRequest(BaseModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: str | None = None
    fieldDefinitions: list[dict[str, Any]] = Field(default_factory=list)
    permissionsPolicy: dict[str, Any] = Field(default_factory=dict)


class ContentTypePatchRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1)
    description: str | None = None
    status: str | None = None
    fieldDefinitions: list[dict[str, Any]] | None = None
    permissionsPolicy: dict[str, Any] | None = None


class ContentCreateRequest(BaseModel):
    contentTypeKey: str = Field(min_length=1)
    name: str = Field(min_length=1)
    content: str
    additionalFields: dict[str, Any] = Field(default_factory=dict)
    aliasPath: str | None = None
    visibility: str = CONTENT_VISIBILITY_PUBLIC
    allowedRoles: list[str] = Field(default_factory=list)
    layoutKey: str | None = None
    linkRefs: list[dict[str, Any]] = Field(default_factory=list)


class ContentPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    content: str | None = None
    additionalFields: dict[str, Any] | None = None
    aliasPath: str | None = None
    visibility: str | None = None
    allowedRoles: list[str] | None = None
    layoutKey: str | None = None
    linkRefs: list[dict[str, Any]] | None = None


class MediaPatchRequest(BaseModel):
    altText: str | None = None
    title: str | None = None
    tags: list[str] | None = None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _serialize_content_type(record) -> dict[str, Any]:
    return {
        "key": record.key,
        "label": record.label,
        "description": record.description,
        "status": record.status,
        "fieldDefinitions": record.field_definitions,
        "permissionsPolicy": record.permissions_policy,
        "systemManaged": record.system_managed,
        "createdAt": _iso(record.created_at),
        "updatedAt": _iso(record.updated_at),
    }


def _serialize_content_item(record) -> dict[str, Any]:
    return {
        "id": record.id,
        "contentTypeKey": record.content_type_key,
        "name": record.name,
        "content": record.content,
        "additionalFields": record.additional_fields,
        "aliasPath": record.alias_path,
        "status": record.status,
        "visibility": record.visibility,
        "allowedRoles": record.allowed_roles,
        "layoutKey": record.layout_key,
        "linkRefs": record.link_refs,
        "createdByUserId": record.created_by_user_id,
        "updatedByUserId": record.updated_by_user_id,
        "publishedAt": _iso(record.published_at),
        "publishedByUserId": record.published_by_user_id,
        "createdAt": _iso(record.created_at),
        "updatedAt": _iso(record.updated_at),
    }


def _serialize_media_item(record) -> dict[str, Any]:
    return {
        "id": record.id,
        "filename": record.filename,
        "contentType": record.content_type,
        "byteSize": record.byte_size,
        "sha256": record.sha256,
        "uploadedByUserId": record.uploaded_by_user_id,
        "createdAt": _iso(record.created_at),
        "updatedAt": _iso(record.updated_at),
        "altText": record.alt_text,
        "title": record.title,
        "tags": record.tags,
    }


def _get_optional_user(request: Request):
    auth_context = getattr(request.state, "auth_context", None)
    if auth_context is None or not auth_context.is_authenticated or not auth_context.user_id:
        return None
    auth_store = request.app.state.auth_store
    user = auth_store.get_user(auth_context.user_id)
    if user is None or user.status != "active":
        return None
    return user


def _is_editor_or_superuser(request: Request, user: UserRecord | None) -> bool:
    if user is None:
        return False
    auth_store = request.app.state.auth_store
    return has_any_role(
        auth_store,
        user_id=user.id,
        direct_roles=user.roles,
        required_roles={ROLE_CONTENT_EDITOR, ROLE_SUPERUSER},
    )


def _validate_visibility(visibility: str, allowed_roles: list[str]) -> None:
    if visibility not in {CONTENT_VISIBILITY_PUBLIC, CONTENT_VISIBILITY_AUTHENTICATED, CONTENT_VISIBILITY_ROLES}:
        raise ApiError(status_code=400, code="VISIBILITY_INVALID", message="Invalid visibility value")
    if visibility == CONTENT_VISIBILITY_ROLES and not allowed_roles:
        raise ApiError(status_code=400, code="ALLOWED_ROLES_REQUIRED", message="allowedRoles is required when visibility=roles")


def _ensure_editor_or_superuser(request: Request, current_user: UserRecord) -> None:
    if not _is_editor_or_superuser(request, current_user):
        raise ApiError(status_code=403, code="INSUFFICIENT_ROLE", message="Insufficient role")


def _can_read_published(content, user: UserRecord | None) -> bool:
    if content.status != CONTENT_STATUS_PUBLISHED:
        return False
    if content.visibility == CONTENT_VISIBILITY_PUBLIC:
        return True
    if user is None:
        return False
    if content.visibility == CONTENT_VISIBILITY_AUTHENTICATED:
        return True
    if content.visibility == CONTENT_VISIBILITY_ROLES:
        return bool(set(user.roles).intersection(set(content.allowed_roles)))
    return False


@router.get("/content/types")
def list_content_types(request: Request) -> dict[str, Any]:
    cms_store = request.app.state.cms_store
    return {"items": [_serialize_content_type(item) for item in cms_store.list_content_types(active_only=True)]}


@admin_router.post("/content/types")
def create_content_type(payload: ContentTypeCreateRequest, request: Request, _: UserRecord = Depends(require_superuser)) -> dict[str, Any]:
    cms_store = request.app.state.cms_store
    try:
        created = cms_store.create_content_type(
            key=payload.key,
            label=payload.label,
            description=payload.description,
            field_definitions=payload.fieldDefinitions,
            permissions_policy=payload.permissionsPolicy,
        )
    except ValueError as exc:
        if str(exc) == "CONTENT_TYPE_EXISTS":
            raise ApiError(status_code=409, code="CONTENT_TYPE_EXISTS", message="Content type already exists") from exc
        raise ApiError(status_code=400, code="CONTENT_TYPE_CREATE_FAILED", message="Unable to create content type") from exc
    return _serialize_content_type(created)


@admin_router.patch("/content/types/{key}")
def patch_content_type(
    key: str,
    payload: ContentTypePatchRequest,
    request: Request,
    _: UserRecord = Depends(require_superuser),
) -> dict[str, Any]:
    cms_store = request.app.state.cms_store
    try:
        updated = cms_store.update_content_type(
            key=key,
            label=payload.label,
            description=payload.description,
            status=payload.status,
            field_definitions=payload.fieldDefinitions,
            permissions_policy=payload.permissionsPolicy,
        )
    except ValueError as exc:
        if str(exc) == "CONTENT_TYPE_PROTECTED":
            raise ApiError(status_code=400, code="CONTENT_TYPE_PROTECTED", message="Built-in content type cannot be disabled") from exc
        raise ApiError(status_code=400, code="CONTENT_TYPE_UPDATE_FAILED", message="Unable to update content type") from exc
    if updated is None:
        raise ApiError(status_code=404, code="CONTENT_TYPE_NOT_FOUND", message="Content type not found")
    return _serialize_content_type(updated)


@router.get("/content")
def list_content(request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    cms_store = request.app.state.cms_store
    is_editor = _is_editor_or_superuser(request, current_user)
    items = cms_store.list_content_items()
    if is_editor:
        return {"items": [_serialize_content_item(item) for item in items]}
    return {
        "items": [
            _serialize_content_item(item)
            for item in items
            if _can_read_published(item, current_user)
        ]
    }


@router.post("/content")
def create_content(payload: ContentCreateRequest, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    _validate_visibility(payload.visibility, payload.allowedRoles)

    cms_store = request.app.state.cms_store
    try:
        created = cms_store.create_content_item(
            content_type_key=payload.contentTypeKey,
            name=payload.name,
            content=payload.content,
            additional_fields=payload.additionalFields,
            alias_path=payload.aliasPath,
            visibility=payload.visibility,
            allowed_roles=payload.allowedRoles,
            layout_key=payload.layoutKey,
            link_refs=payload.linkRefs,
            created_by_user_id=current_user.id,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "CONTENT_TYPE_NOT_FOUND":
            raise ApiError(status_code=404, code=code, message="Content type not found") from exc
        if code == "ALIAS_CONFLICT":
            raise ApiError(status_code=409, code=code, message="Alias path is already in use") from exc
        raise ApiError(status_code=400, code="CONTENT_CREATE_FAILED", message="Unable to create content") from exc
    return _serialize_content_item(created)


@router.get("/content/{content_id}")
def get_content(content_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    cms_store = request.app.state.cms_store
    content = cms_store.get_content_item(content_id)
    if content is None:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")
    if not _is_editor_or_superuser(request, current_user) and not _can_read_published(content, current_user):
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")
    return _serialize_content_item(content)


@router.patch("/content/{content_id}")
def patch_content(
    content_id: str,
    payload: ContentPatchRequest,
    request: Request,
    current_user: UserRecord = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    if payload.visibility is not None:
        _validate_visibility(payload.visibility, payload.allowedRoles or [])

    cms_store = request.app.state.cms_store
    try:
        updated = cms_store.update_content_item(
            content_id=content_id,
            name=payload.name,
            content=payload.content,
            additional_fields=payload.additionalFields,
            alias_path=payload.aliasPath,
            visibility=payload.visibility,
            allowed_roles=payload.allowedRoles,
            layout_key=payload.layoutKey,
            link_refs=payload.linkRefs,
            updated_by_user_id=current_user.id,
        )
    except ValueError as exc:
        if str(exc) == "ALIAS_CONFLICT":
            raise ApiError(status_code=409, code="ALIAS_CONFLICT", message="Alias path is already in use") from exc
        raise ApiError(status_code=400, code="CONTENT_UPDATE_FAILED", message="Unable to update content") from exc
    if updated is None:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")
    return _serialize_content_item(updated)


@router.post("/content/{content_id}/publish")
def publish_content(content_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    cms_store = request.app.state.cms_store
    published = cms_store.publish_content_item(content_id=content_id, user_id=current_user.id)
    if published is None:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")
    return _serialize_content_item(published)


@router.post("/content/{content_id}/unpublish")
def unpublish_content(content_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    cms_store = request.app.state.cms_store
    unpublished = cms_store.unpublish_content_item(content_id=content_id, user_id=current_user.id)
    if unpublished is None:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")
    return _serialize_content_item(unpublished)


@router.delete("/content/{content_id}")
def delete_content(content_id: str, request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    cms_store = request.app.state.cms_store
    deleted = cms_store.delete_content_item(content_id=content_id)
    if not deleted:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")
    return {"success": True}


@router.get("/cms/resolve")
def resolve_cms_path(path: str, request: Request) -> dict[str, Any]:
    cms_store = request.app.state.cms_store
    user = _get_optional_user(request)
    normalized_path = normalize_alias_path(path)
    if normalized_path is None:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")

    content = cms_store.get_content_item_by_alias(normalized_path)
    if content is None:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")

    can_preview = _is_editor_or_superuser(request, user)
    if not can_preview and not _can_read_published(content, user):
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")

    return {
        "matched": True,
        "content": _serialize_content_item(content),
        "canonicalUrl": content.alias_path,
        "visibility": content.visibility,
    }


@router.get("/cms/{content_id}")
def get_public_content(content_id: str, request: Request) -> dict[str, Any]:
    cms_store = request.app.state.cms_store
    user = _get_optional_user(request)
    content = cms_store.get_content_item(content_id)
    if content is None:
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")

    can_preview = _is_editor_or_superuser(request, user)
    if not can_preview and not _can_read_published(content, user):
        raise ApiError(status_code=404, code="CONTENT_NOT_FOUND", message="Content not found")

    return {
        "content": _serialize_content_item(content),
        "canonicalUrl": content.alias_path,
        "visibility": content.visibility,
        "preview": bool(can_preview and content.status != CONTENT_STATUS_PUBLISHED),
    }


@router.post("/media/images")
async def upload_media_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: UserRecord = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise ApiError(status_code=400, code="MEDIA_TYPE_INVALID", message="Only image uploads are allowed")

    media_store = request.app.state.media_store
    payload = await file.read()
    if payload is None:
        payload = b""
    record = media_store.upload_image(
        filename=file.filename or "upload",
        content_type=file.content_type,
        file_bytes=payload,
        uploaded_by_user_id=current_user.id,
    )
    return _serialize_media_item(record)


@router.get("/media/images")
def list_media_images(request: Request, current_user: UserRecord = Depends(get_current_user)) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    media_store = request.app.state.media_store
    return {"items": [_serialize_media_item(item) for item in media_store.list_media()]}


@router.get("/media/images/{media_id}")
def get_media_image(media_id: str, request: Request) -> Response:
    media_store = request.app.state.media_store
    item = media_store.get_media(media_id)
    if item is None:
        raise ApiError(status_code=404, code="MEDIA_NOT_FOUND", message="Media not found")

    file_bytes = media_store.get_media_bytes(media_id)
    if file_bytes is None:
        raise ApiError(status_code=404, code="MEDIA_NOT_FOUND", message="Media not found")

    return Response(
        content=file_bytes,
        media_type=item.content_type,
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.patch("/media/images/{media_id}")
def patch_media_image(
    media_id: str,
    payload: MediaPatchRequest,
    request: Request,
    current_user: UserRecord = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    media_store = request.app.state.media_store
    updated = media_store.update_media_metadata(
        media_id=media_id,
        alt_text=payload.altText,
        title=payload.title,
        tags=payload.tags,
    )
    if updated is None:
        raise ApiError(status_code=404, code="MEDIA_NOT_FOUND", message="Media not found")
    return _serialize_media_item(updated)


@router.delete("/media/images/{media_id}")
def delete_media_image(
    media_id: str,
    request: Request,
    current_user: UserRecord = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_editor_or_superuser(request, current_user)
    media_store = request.app.state.media_store
    deleted = media_store.delete_media(media_id)
    if not deleted:
        raise ApiError(status_code=404, code="MEDIA_NOT_FOUND", message="Media not found")
    return {"success": True}