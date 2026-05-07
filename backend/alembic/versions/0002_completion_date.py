"""replace completed_at DateTime with completed_date Date + unique constraint

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-07
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop and recreate: we're pre-production, no data to migrate
    op.drop_table("habit_completions")
    op.create_table(
        "habit_completions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "habit_id",
            sa.Integer(),
            sa.ForeignKey("habits.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Stores the calendar date in the user's local timezone (client-supplied).
        # No time component: a habit is done "on a day", not "at a moment".
        sa.Column("completed_date", sa.Date(), nullable=False),
        sa.UniqueConstraint("habit_id", "completed_date", name="uq_habit_completions"),
    )
    op.create_index("ix_habit_completions_habit_id", "habit_completions", ["habit_id"])
    op.create_index("ix_habit_completions_user_id", "habit_completions", ["user_id"])


def downgrade() -> None:
    op.drop_table("habit_completions")
    op.create_table(
        "habit_completions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "habit_id",
            sa.Integer(),
            sa.ForeignKey("habits.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_habit_completions_habit_id", "habit_completions", ["habit_id"])
