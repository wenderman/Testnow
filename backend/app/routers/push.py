import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.config import VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_EMAIL
from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/push", tags=["push"])


def _vapid_configured() -> bool:
    return bool(VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)


def _require_vapid():
    if not _vapid_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured on this server",
        )


# ── Public key (no auth required; browsers need it before subscribing) ─────

@router.get("/vapid-public-key")
def get_vapid_public_key():
    _require_vapid()
    return {"public_key": VAPID_PUBLIC_KEY}


# ── Subscribe ───────────────────────────────────────────────────────────────

@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe(
    body: schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _require_vapid()

    existing = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.endpoint == body.endpoint)
        .first()
    )
    if existing:
        # Re-subscription from the same device: refresh keys
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        existing.user_id = user.id
    else:
        db.add(
            models.PushSubscription(
                user_id=user.id,
                endpoint=body.endpoint,
                p256dh=body.p256dh,
                auth=body.auth,
            )
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()

    return {"status": "subscribed"}


# ── Unsubscribe ─────────────────────────────────────────────────────────────

@router.delete("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    body: schemas.PushUnsubscribeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == user.id,
        models.PushSubscription.endpoint == body.endpoint,
    ).delete()
    db.commit()


# ── Send test notification ──────────────────────────────────────────────────

@router.post("/test")
def send_test_notification(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _require_vapid()

    subs = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.user_id == user.id)
        .all()
    )
    if not subs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No push subscriptions found for this user",
        )

    # Import here to avoid startup error when pywebpush is absent
    from pywebpush import webpush, WebPushException  # noqa: PLC0415

    payload = json.dumps(
        {
            "title": "Habit Tracker",
            "body": "🌱 Тестовое уведомление работает!",
            "url": "/",
        }
    )
    vapid_claims = {"sub": f"mailto:{VAPID_EMAIL}"}

    sent = 0
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
            sent += 1
        except WebPushException as exc:
            resp = exc.response
            # 404/410 = subscription expired or unregistered
            if resp is not None and resp.status_code in (404, 410):
                stale_ids.append(sub.id)
        except Exception:  # noqa: BLE001
            pass  # network errors — don't crash, try remaining subs

    if stale_ids:
        db.query(models.PushSubscription).filter(
            models.PushSubscription.id.in_(stale_ids)
        ).delete()
        db.commit()

    return {"sent": sent, "stale_removed": len(stale_ids)}
