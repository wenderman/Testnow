"""
Daily habit-reminder scheduler.

Runs once per day (REMINDER_HOUR:REMINDER_MINUTE UTC). For every user that has
at least one active push subscription the job finds habits not yet marked today
and sends a single push notification listing them.

Stale subscriptions (browser returns 404/410) are removed from the DB
so the table stays clean without manual intervention.
"""

import json
import logging
from datetime import date

from sqlalchemy.orm import Session

from app import models
from app.config import VAPID_EMAIL, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY
from app.database import SessionLocal

logger = logging.getLogger(__name__)


def send_daily_reminders() -> None:
    """Entry point called by APScheduler — always runs in a background thread."""
    if not (VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY):
        logger.info("[scheduler] VAPID not configured — skipping reminders")
        return

    today = date.today()
    logger.info("[scheduler] Sending daily reminders for %s", today)

    db = SessionLocal()
    try:
        stats = _run(db, today)
        logger.info(
            "[scheduler] Done: users=%d sent=%d skipped=%d stale_removed=%d",
            stats["users"],
            stats["sent"],
            stats["skipped"],
            stats["stale_removed"],
        )
    except Exception:
        logger.exception("[scheduler] Unhandled error")
    finally:
        db.close()


def _run(db: Session, today: date) -> dict:
    from pywebpush import WebPushException, webpush  # noqa: PLC0415

    # Distinct user IDs that have at least one subscription
    user_ids = [
        row[0]
        for row in db.query(models.PushSubscription.user_id).distinct().all()
    ]

    stats = {"users": len(user_ids), "sent": 0, "skipped": 0, "stale_removed": 0}

    vapid_claims = {"sub": f"mailto:{VAPID_EMAIL}"}

    for user_id in user_ids:
        habits = (
            db.query(models.Habit)
            .filter(models.Habit.user_id == user_id)
            .all()
        )
        if not habits:
            stats["skipped"] += 1
            continue

        # Habit IDs completed today
        done_ids = {
            row[0]
            for row in db.query(models.HabitCompletion.habit_id)
            .filter(
                models.HabitCompletion.user_id == user_id,
                models.HabitCompletion.completed_date == today,
            )
            .all()
        }

        pending = [h for h in habits if h.id not in done_ids]
        if not pending:
            stats["skipped"] += 1
            continue

        payload = _build_payload(pending)

        subs = (
            db.query(models.PushSubscription)
            .filter(models.PushSubscription.user_id == user_id)
            .all()
        )

        stale_ids = []
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=vapid_claims,
                )
                stats["sent"] += 1
            except WebPushException as exc:
                resp = exc.response
                if resp is not None and resp.status_code in (404, 410):
                    # Browser unregistered this endpoint — safe to delete
                    stale_ids.append(sub.id)
                    logger.debug(
                        "[scheduler] Stale subscription %d (HTTP %d)",
                        sub.id,
                        resp.status_code,
                    )
                else:
                    logger.warning("[scheduler] Push failed sub=%d: %s", sub.id, exc)
            except Exception as exc:  # noqa: BLE001
                logger.warning("[scheduler] Push failed sub=%d: %s", sub.id, exc)

        if stale_ids:
            db.query(models.PushSubscription).filter(
                models.PushSubscription.id.in_(stale_ids)
            ).delete()
            db.commit()
            stats["stale_removed"] += len(stale_ids)

    return stats


def _build_payload(pending: list) -> str:
    names = [h.name for h in pending[:3]]
    if len(pending) > 3:
        names.append(f"и ещё {len(pending) - 3}")

    total = len(pending)
    if total == 1:
        body = f"Не выполнено: {names[0]}"
    else:
        body = f"Не выполнено {total}: {', '.join(names)}"

    return json.dumps({"title": "🌱 Habit Tracker", "body": body, "url": "/"})
