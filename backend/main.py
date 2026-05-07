from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.routers.auth import router as auth_router
from app.routers.habits import router as habits_router

app = FastAPI(title="Habit Tracker API", version="0.1.0")

app.include_router(auth_router)
app.include_router(habits_router)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
