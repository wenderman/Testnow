# Habit Tracker

Веб-приложение для отслеживания ежедневных привычек.

## Стек

| Сервис   | Технология            | Порт (хост) |
|----------|-----------------------|-------------|
| db       | PostgreSQL 16         | —           |
| backend  | Python / FastAPI      | —           |
| frontend | Nginx (proxy + SPA)   | **80**      |

Nginx проксирует запросы `/api/*` → `backend:8000`.

## Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <repo-url>
cd habit-tracker
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
# Откройте .env и смените пароли и SECRET_KEY для production
```

### 3. Запуск

```bash
docker compose up --build
```

После успешного старта приложение доступно по адресу: **http://localhost**

### 4. Проверка работоспособности

```bash
# Статус API
curl http://localhost/api/health
# {"status":"ok"}

# Статус контейнеров
docker compose ps
```

### 5. Остановка

```bash
docker compose down          # остановить контейнеры
docker compose down -v       # остановить и удалить volumes (данные БД)
```

## Структура проекта

```
.
├── backend/
│   ├── Dockerfile
│   ├── main.py          # FastAPI-приложение
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   ├── index.html       # SPA-заглушка
│   └── nginx/
│       └── default.conf # Nginx + proxy-правила
├── docker-compose.yml
├── .env.example
└── README.md
```

## Переменные окружения

| Переменная        | По умолчанию                                       | Описание                        |
|-------------------|----------------------------------------------------|---------------------------------|
| `POSTGRES_DB`     | `habits`                                           | Имя базы данных                 |
| `POSTGRES_USER`   | `habits_user`                                      | Пользователь БД                 |
| `POSTGRES_PASSWORD` | `changeme`                                       | Пароль БД (**сменить!**)        |
| `DATABASE_URL`    | `postgresql://habits_user:changeme@db:5432/habits` | DSN для backend                 |
| `SECRET_KEY`      | `change-me-in-production`                          | Секретный ключ (**сменить!**)   |
| `FRONTEND_PORT`   | `80`                                               | Порт Nginx на хосте             |
