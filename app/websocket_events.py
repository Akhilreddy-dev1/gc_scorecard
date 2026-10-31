from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ScoringRule, User, UserScore


class ChatEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event_type: str = Field(alias="type")
    user_id: UUID
    content: str | None = None
    message_id: str | None = None
    media_url: str | None = None


RULE_ACTIONS = {
    "text": "text_message",
    "reaction": "reaction",
    "media": "media_upload",
    "reel_share": "share_reel",
}


def record_event(
    db: Session,
    group_id: UUID,
    event: ChatEvent,
) -> tuple[int, int, list[dict]]:
    action = RULE_ACTIONS.get(event.event_type)
    if action is None:
        raise ValueError(f"Unsupported event type: {event.event_type}")

    rule = db.scalar(select(ScoringRule).where(ScoringRule.action == action))
    if rule is None:
        raise ValueError(f"No scoring rule configured for {action}")

    user = db.get(User, event.user_id)
    if user is None:
        raise ValueError("User does not exist")

    score = db.scalar(
        select(UserScore).where(
            UserScore.user_id == event.user_id,
            UserScore.group_id == group_id,
        )
    )
    if score is None:
        score = UserScore(user_id=event.user_id, group_id=group_id, points=rule.points)
        db.add(score)
    else:
        score.points += rule.points
    db.flush()

    scores = db.execute(
        select(UserScore, User.username)
        .join(User, User.id == UserScore.user_id)
        .where(UserScore.group_id == group_id)
        .order_by(UserScore.points.desc(), User.username)
    )
    live_scores = [
        {"user_id": str(user_score.user_id), "username": username, "points": user_score.points}
        for user_score, username in scores
    ]
    points_awarded = rule.points
    total_points = score.points
    db.commit()
    return points_awarded, total_points, live_scores
