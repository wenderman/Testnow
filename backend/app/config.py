import os

DATABASE_URL: str = os.environ["DATABASE_URL"]
SECRET_KEY: str = os.environ.get("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
