from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, GroupMember, User, UserScore
from app.schemas import SessionRequest, SessionResponse

router = APIRouter(prefix="/api", tags=["groups"])


@router.post("/session", response_model=SessionResponse)
def create_or_join_session(
    payload: SessionRequest,
    db: Session = Depends(get_db),
) -> SessionResponse:
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
def get_group_scores(group_id: UUID, db: Session = Depends(get_db)) -> list[dict]:
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
