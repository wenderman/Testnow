from fastapi import FastAPI

app = FastAPI(title="Habit Tracker API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Habit Tracker API"}
