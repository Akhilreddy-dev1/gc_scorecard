from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ScoringRule

DEFAULT_SCORING_RULES = {
    "text_message": (3, "Sending a text message"),
    "reaction": (1, "Reacting to a message"),
    "media_upload": (4, "Uploading media"),
    "share_reel": (5, "Sharing a reel"),
}


def seed_scoring_rules(db: Session) -> None:
    existing_actions = set(db.scalars(select(ScoringRule.action)).all())
    for action, (points, description) in DEFAULT_SCORING_RULES.items():
        if action not in existing_actions:
            db.add(
                ScoringRule(
                    action=action,
                    points=points,
                    description=description,
                )
            )
    db.commit()
