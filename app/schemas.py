from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ScoringRuleResponse(BaseModel):
    id: UUID
    action: str
    points: int
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)
