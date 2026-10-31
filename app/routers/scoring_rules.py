from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ScoringRule
from app.schemas import ScoringRuleResponse

router = APIRouter(prefix="/api", tags=["scoring rules"])


@router.get("/scoring-rules", response_model=list[ScoringRuleResponse])
def get_scoring_rules(db: Session = Depends(get_db)) -> list[ScoringRule]:
    return list(db.scalars(select(ScoringRule).order_by(ScoringRule.action)).all())
