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

    user = db.get(User, payload.user_id) if payload.user_id else None
    if user is None:
        user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username)
        db.add(user)
        db.flush()
    else:
        user.username = username

    group = db.get(Group, payload.group_id) if payload.group_id else None
    if payload.group_id and group is None:
        raise HTTPException(status_code=404, detail="That room does not exist")
    if group is None:
        group = Group(id=uuid4(), name=f"{username}'s room")
        db.add(group)
        db.flush()

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
