import os

DATABASE_URL: str = os.environ["DATABASE_URL"]
SECRET_KEY: str = os.environ.get("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# VAPID keys for Web Push (generate with backend/generate_vapid.py)
# Store the private key PEM with literal \n between lines, e.g.:
#   VAPID_PRIVATE_KEY=-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE...\n-----END EC PRIVATE KEY-----\n
VAPID_PRIVATE_KEY: str = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_PUBLIC_KEY: str = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_EMAIL: str = os.environ.get("VAPID_EMAIL", "admin@example.com")

# Daily reminder schedule (UTC). Set REMINDER_HOUR=-1 to disable.
REMINDER_HOUR: int = int(os.environ.get("REMINDER_HOUR", "8"))
REMINDER_MINUTE: int = int(os.environ.get("REMINDER_MINUTE", "0"))
