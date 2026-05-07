from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models, schemas
from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/habits", tags=["habits"])


@router.post("", response_model=schemas.HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(
    body: schemas.HabitCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    habit = models.Habit(user_id=user.id, name=body.name.strip(), description=body.description)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@router.get("", response_model=list[schemas.HabitOut])
def list_habits(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Habit)
        .filter(models.Habit.user_id == user.id)
        .order_by(models.Habit.created_at.desc())
        .all()
    )


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == user.id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    db.delete(habit)
    db.commit()
