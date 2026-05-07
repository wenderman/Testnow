from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import models, schemas
from app.dependencies import get_db, get_current_user

router = APIRouter(tags=["completions"])

_MAX_PERIOD_DAYS = 366


def _client_today(utc_offset_minutes: int) -> date:
    return (datetime.utcnow() + timedelta(minutes=utc_offset_minutes)).date()


def _get_habit_or_404(habit_id: int, user_id: int, db: Session) -> models.Habit:
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == user_id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    return habit


@router.post(
    "/habits/{habit_id}/completions",
    response_model=schemas.CompletionOut,
    status_code=status.HTTP_201_CREATED,
)
def mark_completion(
    habit_id: int,
    body: schemas.CompletionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_habit_or_404(habit_id, user.id, db)

    if body.date > _client_today(body.utc_offset_minutes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot mark a future date",
        )

    completion = models.HabitCompletion(
        habit_id=habit_id,
        user_id=user.id,
        completed_date=body.date,
    )
    db.add(completion)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Habit already marked for this date",
        )
    db.refresh(completion)
    return completion


@router.delete(
    "/habits/{habit_id}/completions/{completed_date}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unmark_completion(
    habit_id: int,
    completed_date: date,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_habit_or_404(habit_id, user.id, db)

    completion = (
        db.query(models.HabitCompletion)
        .filter(
            models.HabitCompletion.habit_id == habit_id,
            models.HabitCompletion.user_id == user.id,
            models.HabitCompletion.completed_date == completed_date,
        )
        .first()
    )
    if not completion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Completion not found",
        )
    db.delete(completion)
    db.commit()


@router.get("/completions", response_model=list[schemas.CompletionOut])
def list_completions(
    from_date: date = Query(..., alias="from", description="Start date inclusive (YYYY-MM-DD)"),
    to_date: date = Query(..., alias="to", description="End date inclusive (YYYY-MM-DD)"),
    habit_id: int | None = Query(None, description="Filter by a specific habit"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'from' must not be later than 'to'",
        )
    if (to_date - from_date).days > _MAX_PERIOD_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Period cannot exceed {_MAX_PERIOD_DAYS} days",
        )

    q = db.query(models.HabitCompletion).filter(
        models.HabitCompletion.user_id == user.id,
        models.HabitCompletion.completed_date >= from_date,
        models.HabitCompletion.completed_date <= to_date,
    )
    if habit_id is not None:
        q = q.filter(models.HabitCompletion.habit_id == habit_id)

    return q.order_by(models.HabitCompletion.completed_date).all()
