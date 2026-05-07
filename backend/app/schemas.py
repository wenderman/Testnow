from datetime import date, datetime
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class HabitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)


class HabitOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompletionCreate(BaseModel):
    date: date
    # Minutes east of UTC (e.g. UTC+3 → 180, UTC-5 → -300).
    # Used only to determine "today" for the future-date guard; not stored.
    utc_offset_minutes: int = Field(0, ge=-720, le=840)


class CompletionOut(BaseModel):
    habit_id: int
    completed_date: date

    model_config = {"from_attributes": True}
