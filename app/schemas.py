from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ScoringRuleResponse(BaseModel):
    id: UUID
    action: str
    points: int
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SessionRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    user_id: UUID | None = None
    group_id: UUID | None = None
    group_name: str | None = Field(default=None, min_length=1, max_length=150)


class SessionResponse(BaseModel):
    user_id: UUID
    username: str
    group_id: UUID
    group_name: str
