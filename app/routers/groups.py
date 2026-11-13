import secrets
from datetime import datetime, timezone
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL
from itsdangerous import URLSafeTimedSerializer, BadSignature

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChatMessage, Group, GroupMember, User, UserScore
from app.schemas import SessionRequest, SessionResponse
from app.config import get_settings

router = APIRouter(prefix="/api", tags=["groups"])
PRIVATE_GROUP_ID = uuid5(NAMESPACE_URL, "UNFILTERED_HOOMANS_MAIN")
ROSTER = {
    "akhil": ("Akhil", "owner", "/avatars/akhil.jpg"), "varun": ("Varun", "member", "/avatars/varun.jpg"),
    "yaswanth": ("Yaswanth", "member", "/avatars/yaswanth.jpg"), "binduja": ("Binduja", "member", "/avatars/binduja.jpg"),
    "haasini": ("Haasini", "member", "/avatars/haasini-shreeraj.jpg"), "shreeraj": ("Shreeraj", "member", "/avatars/haasini-shreeraj.jpg"),
    "swejith": ("Swejith", "member", "/avatars/swejith.jpg"), "hasini": ("Hasini", "member", "/avatars/hasini.jpg"),
    "harini": ("Harini", "member", "/avatars/harini.jpg"), "vaagdevi": ("Vaagdevi", "member", "/avatars/vaagdevi.jpg"),
    "avinash": ("Avinash", "member", "/avatars/avinash.jpg"), "dheeraj": ("Dheeraj", "member", "/avatars/dheeraj.jpg"),
}
PASSWORDS = {
    "akhil": "Akhil123",
    "varun": "Varun123",
    "yaswanth": "Yaswanth123",
    "binduja": "Binduja123",
    "haasini": "Haasini123",
    "shreeraj": "Shreeraj123",
    "swejith": "Swejith123",
    "hasini": "Hasini123",
    "harini": "Harini123",
    "vaagdevi": "Vaagdevi123",
    "avinash": "Avinash123",
    "dheeraj": "Dheeraj123",
}

def issue_auth_token(user_id: UUID, member_id: str) -> str:
    secret = get_settings().auth_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Backend AUTH_SECRET is not configured")
    return URLSafeTimedSerializer(secret, salt="scorecard-session").dumps({"user_id": str(user_id), "member_id": member_id})

def verify_auth_token(token: str) -> dict | None:
    secret = get_settings().auth_secret
    if not secret: return None
    try: return URLSafeTimedSerializer(secret, salt="scorecard-session").loads(token, max_age=60 * 60 * 24 * 30)
    except BadSignature: return None


def require_group_session(group_id: UUID, authorization: str | None) -> dict:
    token = authorization.removeprefix("Bearer ") if authorization else ""
    auth = verify_auth_token(token)
    if not auth or auth.get("member_id") not in ROSTER or group_id != PRIVATE_GROUP_ID:
        raise HTTPException(status_code=401, detail="Sign in to access this chat")
    return auth


@router.get("/groups/{group_id}/messages")
def get_chat_history(group_id: UUID, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> list[dict]:
    require_group_session(group_id, authorization)
    rows = db.execute(
        select(ChatMessage, User.username)
        .join(User, User.id == ChatMessage.user_id)
        .where(ChatMessage.group_id == group_id)
        .order_by(ChatMessage.created_at, ChatMessage.id)
    )
    return [{"type": message.event_type, "user_id": str(message.user_id), "username": username,
             "message_id": str(message.id), "content": message.content, "media_url": message.media_url,
             "sent_at": message.created_at.isoformat()} for message, username in rows]


@router.delete("/groups/{group_id}/messages")
async def delete_chat_history(group_id: UUID, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict[str, str]:
    auth = require_group_session(group_id, authorization)
    if auth.get("member_id") != "akhil":
        raise HTTPException(status_code=403, detail="Only the owner can delete chat history")
    db.execute(delete(ChatMessage).where(ChatMessage.group_id == group_id))
    db.commit()
    from app.websocket_manager import manager
    await manager.broadcast(str(group_id), {"type": "history_cleared"})
    return {"status": "cleared"}

@router.post("/auth/verify")
def verify_member(payload: dict, db: Session = Depends(get_db)) -> dict:
    member_id = str(payload.get("member_id", "")); password = str(payload.get("password", ""))
    expected_password = PASSWORDS.get(member_id, "")
    if member_id not in ROSTER or not secrets.compare_digest(password, expected_password):
        raise HTTPException(status_code=401, detail="Avatar or password is incorrect")
    name, role, avatar = ROSTER[member_id]
    user_id = uuid5(NAMESPACE_URL, f"UNFILTERED_HOOMANS_MAIN:{member_id}")
    group = db.get(Group, PRIVATE_GROUP_ID)
    if group is None:
        group = Group(id=PRIVATE_GROUP_ID, name="The unfiltered hoomans"); db.add(group)
    user = db.get(User, user_id)
    if user is None: user = User(id=user_id, username=name); db.add(user)
    if db.scalar(select(GroupMember).where(GroupMember.user_id == user_id, GroupMember.group_id == PRIVATE_GROUP_ID)) is None:
        db.add(GroupMember(user_id=user_id, group_id=PRIVATE_GROUP_ID))
    db.commit()
    return {"user_id": str(user_id), "username": name, "group_id": str(PRIVATE_GROUP_ID), "group_name": group.name,
            "access_token": issue_auth_token(user_id, member_id), "member": {"id": member_id, "name": name, "role": role, "avatar": avatar}}


@router.post("/session", response_model=SessionResponse)
def create_or_join_session(
    payload: SessionRequest,
    db: Session = Depends(get_db),
) -> SessionResponse:
    raise HTTPException(status_code=410, detail="Room creation and joining were replaced by private avatar login")

    # Kept temporarily for response-model compatibility with older clients.
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=422, detail="Username cannot be empty")

    creating_room = payload.group_name is not None
    if creating_room == (payload.group_id is not None):
        raise HTTPException(
            status_code=422,
            detail="Choose either a room name to create a room or a room code to join one",
        )

    user = db.get(User, payload.user_id) if payload.user_id else None
    if user is None and payload.user_id is None:
        existing_user = db.scalar(select(User).where(User.username == username))
        if existing_user is not None:
            raise HTTPException(
                status_code=409,
                detail="That name is already in use. Choose another name or restore your saved session.",
            )
    if user is None:
        user = User(id=payload.user_id, username=username) if payload.user_id else User(username=username)
        db.add(user)
        db.flush()
    else:
        existing_user = db.scalar(
            select(User).where(User.username == username, User.id != user.id)
        )
        if existing_user is not None:
            raise HTTPException(
                status_code=409,
                detail="That name is already in use. Choose another name.",
            )
        user.username = username

    if creating_room:
        room_name = payload.group_name.strip()
        if not room_name:
            raise HTTPException(status_code=422, detail="Room name cannot be empty")
        group = Group(id=uuid4(), name=room_name)
        db.add(group)
        db.flush()
    else:
        group = db.get(Group, payload.group_id)
        if group is None:
            raise HTTPException(status_code=404, detail="That room does not exist")

    membership = db.scalar(
        select(GroupMember).where(
            GroupMember.user_id == user.id,
            GroupMember.group_id == group.id,
        )
    )
    if membership is None:
        db.add(GroupMember(user_id=user.id, group_id=group.id))

    db.commit()
    return SessionResponse(
        user_id=user.id,
        username=user.username,
        group_id=group.id,
        group_name=group.name,
    )

@router.get("/groups/{group_id}/scores")
def get_group_scores(group_id: UUID, authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> list[dict]:
    token = authorization.removeprefix("Bearer ") if authorization else ""
    auth = verify_auth_token(token)
    if not auth or auth.get("member_id") not in ROSTER or group_id != PRIVATE_GROUP_ID:
        raise HTTPException(status_code=401, detail="Sign in to view this scorecard")
    if auth["member_id"] != "akhil" and datetime.now(timezone.utc) < datetime(2026, 11, 20, 0, 0, tzinfo=timezone.utc):
        raise HTTPException(status_code=423, detail="Scorecard is locked until November 20, 2026")
    if db.get(Group, group_id) is None:
        raise HTTPException(status_code=404, detail="That room does not exist")

    rows = db.execute(
        select(UserScore, User.username)
        .join(User, User.id == UserScore.user_id)
        .where(UserScore.group_id == group_id)
        .order_by(UserScore.points.desc(), User.username)
    )
    return [
        {"user_id": str(score.user_id), "username": username, "points": score.points}
        for score, username in rows
    ]
