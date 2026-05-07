import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import REMINDER_HOUR, REMINDER_MINUTE
from app.routers.auth import router as auth_router
from app.routers.completions import router as completions_router
from app.routers.habits import router as habits_router
from app.routers.push import router as push_router
from app.scheduler import send_daily_reminders

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    scheduler = None
    if REMINDER_HOUR >= 0:
        scheduler = BackgroundScheduler(timezone="UTC")
        scheduler.add_job(
            send_daily_reminders,
            trigger="cron",
            hour=REMINDER_HOUR,
            minute=REMINDER_MINUTE,
            id="daily_reminder",
            replace_existing=True,
            misfire_grace_time=3600,  # allow up to 1 h delay before skipping
        )
        scheduler.start()
        logger.info(
            "Scheduler started — daily reminders at %02d:%02d UTC", REMINDER_HOUR, REMINDER_MINUTE
        )
    else:
        logger.info("Scheduler disabled (REMINDER_HOUR=%d)", REMINDER_HOUR)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


app = FastAPI(title="Habit Tracker API", version="0.1.0", lifespan=lifespan)

app.include_router(auth_router)
app.include_router(habits_router)
app.include_router(completions_router)
app.include_router(push_router)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
