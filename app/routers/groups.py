import json
from datetime import datetime, timezone
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL
from itsdangerous import URLSafeTimedSerializer, BadSignature

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, GroupMember, User, UserScore
from app.schemas import SessionRequest, SessionResponse
from app.config import get_settings
from app.passwords import verify_password

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

@router.post("/auth/verify")
def verify_member(payload: dict, db: Session = Depends(get_db)) -> dict:
    member_id = str(payload.get("member_id", "")); password = str(payload.get("password", ""))
    encoded_hashes = get_settings().member_password_hashes
    if not encoded_hashes:
        raise HTTPException(status_code=503, detail="Backend MEMBER_PASSWORD_HASHES is not configured")
    try:
        credentials = json.loads(encoded_hashes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="MEMBER_PASSWORD_HASHES must be valid JSON")
    if not isinstance(credentials, dict):
        raise HTTPException(status_code=500, detail="MEMBER_PASSWORD_HASHES must be a JSON object")
    if member_id not in ROSTER or not verify_password(password, str(credentials.get(member_id, ""))):
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
