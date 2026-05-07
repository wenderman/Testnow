# Habit Tracker

Веб-приложение для отслеживания ежедневных привычек с push-напоминаниями.

## Архитектура

```
localhost:80
     │
     ▼
┌─────────────────────┐
│  frontend (Nginx)   │  React SPA (Vite build)
│  /api/* → backend   │  Service Worker + Web Push
└──────────┬──────────┘
           │ proxy /api → :8000
           ▼
┌─────────────────────┐
│  backend (FastAPI)  │  REST API, JWT auth
│  APScheduler cron   │  Ежедневные push-напоминания
└──────────┬──────────┘
           │ SQLAlchemy
           ▼
┌─────────────────────┐
│  db (PostgreSQL 16) │  Alembic-миграции при старте
└─────────────────────┘
```

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone <repo-url>
cd habit-tracker
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
```

Откройте `.env` и задайте:
- `POSTGRES_PASSWORD` — пароль БД
- `SECRET_KEY` — секрет JWT (любая длинная случайная строка)
- VAPID-ключи (см. раздел ниже) — нужны для push-уведомлений

### 3. Запустить

```bash
docker compose up --build
```

При первом запуске Docker скачивает образы, собирает React-приложение и запускает
миграции БД — это занимает 2–4 минуты. При повторных запусках — секунды.

### 4. Проверить

| URL | Что открывается |
|-----|-----------------|
| http://localhost | React SPA |
| http://localhost/api/health | `{"status":"ok"}` |
| http://localhost/api/docs | Swagger UI |

---

## Переменные окружения

### PostgreSQL

| Переменная | Умолчание | Описание |
|------------|-----------|----------|
| `POSTGRES_DB` | `habits` | Имя базы данных |
| `POSTGRES_USER` | `habits_user` | Пользователь БД |
| `POSTGRES_PASSWORD` | `changeme` | Пароль (**обязательно сменить**) |

### Backend

| Переменная | Умолчание | Описание |
|------------|-----------|----------|
| `DATABASE_URL` | `postgresql://habits_user:changeme@db:5432/habits` | DSN подключения |
| `SECRET_KEY` | `change-me-in-production` | Секрет подписи JWT (**сменить**) |

### VAPID (Web Push)

| Переменная | Умолчание | Описание |
|------------|-----------|----------|
| `VAPID_PRIVATE_KEY` | — | PEM-ключ с `\n` вместо переносов строк |
| `VAPID_PUBLIC_KEY` | — | URL-safe base64 публичный ключ для браузера |
| `VAPID_EMAIL` | `admin@example.com` | Контактный email для VAPID-заявок |

Если VAPID не настроен, push-эндпоинты возвращают `503`, кнопка уведомлений
в UI не появляется — всё остальное работает штатно.

### Планировщик напоминаний

| Переменная | Умолчание | Описание |
|------------|-----------|----------|
| `REMINDER_HOUR` | `8` | Час отправки напоминания (UTC, 0–23). `-1` — отключить |
| `REMINDER_MINUTE` | `0` | Минута отправки (0–59) |

> **Важно про часовые пояса.** Напоминание уходит ровно в `REMINDER_HOUR:REMINDER_MINUTE` UTC.
> Для пользователя в UTC+3 это 11:00 по местному. Подберите время с учётом вашей аудитории.
> Пользователи с отмеченными на сегодня привычками напоминаний не получают.

### Nginx / порты

| Переменная | Умолчание | Описание |
|------------|-----------|----------|
| `FRONTEND_PORT` | `80` | Порт Nginx на хосте |

---

## Генерация VAPID-ключей

```bash
# Требует запущенного или одноразового backend-контейнера
docker compose run --rm backend python generate_vapid.py
```

Вывод:
```
VAPID_PRIVATE_KEY=-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE...\n-----END EC PRIVATE KEY-----\n
VAPID_PUBLIC_KEY=BPl3...abc
VAPID_EMAIL=your@email.com
```

Скопируйте строки в `.env`, подставьте свой email и перезапустите:

```bash
docker compose up -d --build backend
```

---

## Push-уведомления в продакшене (HTTPS)

Браузеры разрешают Service Worker и Push API **только на HTTPS-источниках**
(исключение — `localhost` для разработки). В продакшене необходимо:

1. **Обратный прокси с TLS** — например Nginx + Certbot (Let's Encrypt):

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;

    ssl_certificate     /etc/letsencrypt/live/your.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
    }
}
```

2. **Платформы с HTTPS из коробки** — Render, Railway, Fly.io, Cloud Run.

3. **Самоподписанный сертификат** не подходит — браузер его отклонит для Push.

> Service Worker регистрируется по пути `/sw.js` с `scope: '/'`.
> Nginx отдаёт его как статику из `dist/`, без прокси на backend.

---

## API: тестовые сценарии (curl)

Все примеры предполагают `BASE=http://localhost/api`.

### Аутентификация

```bash
# Регистрация
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret123"}' | jq

# Вход
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret123"}' | jq -r .access_token)

echo "Token: $TOKEN"
```

### Привычки

```bash
AUTH="-H 'Authorization: Bearer $TOKEN'"

# Создать привычку
curl -s -X POST $BASE/habits \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Читать 30 минут","description":"Перед сном"}' | jq

# Список привычек
curl -s $BASE/habits -H "Authorization: Bearer $TOKEN" | jq

# Удалить (замените 1 на реальный id)
curl -s -X DELETE $BASE/habits/1 -H "Authorization: Bearer $TOKEN"
```

### Отметки выполнения

```bash
TODAY=$(date +%Y-%m-%d)
OFFSET=$(python3 -c "import time; print(-time.timezone//60)")

# Отметить сегодня (замените 1 на id привычки)
curl -s -X POST $BASE/habits/1/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"date\":\"$TODAY\",\"utc_offset_minutes\":$OFFSET}" | jq

# Получить отметки за месяц
curl -s "$BASE/completions?from=2026-05-01&to=2026-05-31" \
  -H "Authorization: Bearer $TOKEN" | jq

# Снять отметку
curl -s -X DELETE $BASE/habits/1/completions/$TODAY \
  -H "Authorization: Bearer $TOKEN"

# Попытка отметить будущую дату → 400
curl -s -X POST $BASE/habits/1/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"date":"2099-01-01","utc_offset_minutes":0}' | jq
```

### Push-уведомления

```bash
# Публичный VAPID-ключ (нет авторизации)
curl -s $BASE/push/vapid-public-key | jq

# Тестовое уведомление (нужна активная подписка из браузера)
curl -s -X POST $BASE/push/test \
  -H "Authorization: Bearer $TOKEN" | jq

# Запустить планировщик немедленно (для проверки без ожидания cron)
curl -s -X POST $BASE/push/send-reminders \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Проверка healthcheck и swagger

```bash
curl -s $BASE/../health | jq          # {"status":"ok"}
open http://localhost/api/docs         # Swagger UI (браузер)
```

---

## Структура проекта

```
.
├── backend/
│   ├── app/
│   │   ├── config.py          # env-переменные
│   │   ├── database.py        # SQLAlchemy engine
│   │   ├── dependencies.py    # get_db, get_current_user
│   │   ├── models.py          # ORM: User, Habit, HabitCompletion, PushSubscription
│   │   ├── schemas.py         # Pydantic-схемы
│   │   ├── security.py        # bcrypt + JWT
│   │   ├── scheduler.py       # ежедневные push-напоминания
│   │   └── routers/
│   │       ├── auth.py        # /auth/register  /auth/login
│   │       ├── habits.py      # /habits  CRUD
│   │       ├── completions.py # /habits/{id}/completions  /completions
│   │       └── push.py        # /push/*
│   ├── alembic/               # миграции БД
│   ├── generate_vapid.py      # утилита генерации VAPID-ключей
│   ├── entrypoint.sh          # alembic upgrade head → uvicorn
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   └── sw.js              # Service Worker (push + notificationclick)
│   ├── src/
│   │   ├── api.js             # fetch-обёртка для всех API-вызовов
│   │   ├── AuthContext.jsx    # JWT в localStorage
│   │   ├── App.jsx            # routing: AuthPage ↔ HomePage
│   │   ├── index.css          # mobile-first стили
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx   # вход / регистрация
│   │   │   └── HomePage.jsx   # главная: прогресс, привычки, уведомления
│   │   └── components/
│   │       ├── HabitItem.jsx       # карточка привычки
│   │       ├── HabitCalendar.jsx   # месячный календарь-сетка
│   │       └── PushNotifications.jsx  # баннер opt-in уведомлений
│   ├── nginx/default.conf     # proxy /api/* → backend:8000
│   └── Dockerfile             # node:20 build → nginx:1.27 serve
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Управление

```bash
# Запустить (пересборка образов при изменениях)
docker compose up --build

# Запустить в фоне
docker compose up -d --build

# Логи конкретного сервиса
docker compose logs -f backend

# Остановить
docker compose down

# Остановить и удалить данные БД
docker compose down -v

# Пересобрать только backend (после изменений Python-кода)
docker compose up -d --build backend
```
