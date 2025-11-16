# Деплой Poker Mini App на Railway / Render

Проект: `telegram_slot_bot`

Состав:
- `server.py` — FastAPI сервер для Mini App (Telegram WebApp, эндпоинты `/`, `/api/me`, `/api/top`).
- `bot.py` — Telegram‑бот (polling), который показывает кнопку "Открыть мини‑приложение".
- `webapp/` — фронтенд Mini App (HTML + JS).
- `requirements.txt` — зависимости.
- `Procfile` — команды для процессов `web` (сервер) и `worker` (бот).

## Переменные окружения

Обязательно:
- `TELEGRAM_TOKEN` — токен вашего бота от BotFather.

Необязательно (но полезно):
- `WEBAPP_URL` — публичный HTTPS‑URL Mini App, например:
  - Railway/Render: `https://<ваш-проект>.up.railway.app` или `https://<service>.onrender.com`.
  - Можно не задавать: по умолчанию в коде используется значение из окружения, а если вы зададите `WEBAPP_URL` в Railway/Render, бот будет использовать его.

---

## 1. Подготовка репозитория на GitHub

1. Создайте новый репозиторий на GitHub.
2. Скопируйте папку `telegram_slot_bot` целиком в этот репозиторий (как корень репо или как подпапку, но тогда пути в инструкциях нужно будет скорректировать).
3. Убедитесь, что в корне репозитория есть как минимум:
   - `requirements.txt`
   - `server.py`
   - `bot.py`
   - `db.py`
   - `game.py`
   - `webapp/` (с `index.html`, `app.js`)
   - `Procfile`
   - `DEPLOY.md`
4. Сделайте `git add .`, `git commit`, `git push` на GitHub.

---

## 2. Railway: деплой Mini App и бота

### 2.1. Создать проект и сервис web

1. Зайдите на https://railway.app и создайте аккаунт (если ещё нет).
2. Нажмите **New Project** → **Deploy from GitHub repo**.
3. Выберите ваш репозиторий с этим кодом.
4. Railway автоматически обнаружит `Procfile`.
5. В настройках сервиса:
   - Убедитесь, что переменная `PORT` выставлена Railway (обычно она есть автоматически).
   - Добавьте переменную окружения `TELEGRAM_TOKEN` (значение — токен бота).
   - (Опционально) добавьте `WEBAPP_URL`, например: `https://<имя‑проекта>.up.railway.app`.
6. В качестве стартовой команды web‑процесса Railway использует строчку из `Procfile`:
   - `web: uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}`

После деплоя Railway выдаст домен вида:
- `https://<project-name>.up.railway.app`

Этот URL и будет `WEBAPP_URL` для Mini App.

### 2.2. Worker‑процесс для бота

Варианты:

**Вариант A (simple):** один сервис, один процесс `web`, бот не запускается на Railway, а работает локально.

**Вариант B (рекомендуется):** два процесса в одном сервисе (через Procfile):

- `web: uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}`
- `worker: python bot.py`

Railway по Procfile увидит два процесса. В UI Railway можно включить оба (web и worker), чтобы одновременно работали:
- web — Mini App
- worker — бот (polling)

> Важно: убедитесь, что бот не запущен где‑то ещё (локально) одновременно.

### 2.3. Настройка BotFather

1. В Telegram откройте BotFather → ваш бот → **Edit Bot** → **Edit Commands** (по желанию).
2. Самое важное — **меню Mini App** (для WebApp):
   - Команда `/setdomain` или аналог для указания `WEBAPP_URL` (если вы хотите привязать mini app).
   - Убедитесь, что домен соответствует Railway URL.

Поскольку бот работает в режиме **polling**, webhook через BotFather дополнительно настраивать **не нужно**.

---

## 3. Render: деплой Mini App и бота

### 3.1. Web‑Service (Mini App)

1. Зайдите на https://render.com и создайте аккаунт.
2. Нажмите **New +** → **Web Service**.
3. Выберите ваш GitHub‑репозиторий.
4. Укажите:
   - **Environment**: Python.
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. В разделе **Environment Variables**:
   - Добавьте `TELEGRAM_TOKEN`.
   - (Опционально) `WEBAPP_URL` = `https://<service-name>.onrender.com`.

После деплоя Render выдаст URL вида `https://<service-name>.onrender.com` — это и будет `WEBAPP_URL`.

### 3.2. Background Worker (бот)

Для бота создайте отдельный **Background Worker**:

1. **New +** → **Background Worker**.
2. Выберите тот же репозиторий и ветку.
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `python bot.py`
5. Добавьте `TELEGRAM_TOKEN` и тот же `WEBAPP_URL`, что у web‑сервиса.

Worker будет постоянно держать бота запущенным в режиме polling.

---

## 4. Проверка после деплоя

1. Убедитесь, что web‑сервис (Railway или Render) доступен по HTTPS:
   - Откройте URL в браузере, вы должны увидеть Mini App (как в локальном режиме).
2. Убедитесь, что переменная `WEBAPP_URL` у бота совпадает с этим URL.
3. В Telegram:
   - Отправьте `/start` вашему боту.
   - Убедитесь, что появилась кнопка "Открыть мини‑приложение" и при нажатии Mini App открывается.

Если что‑то не работает — проверьте логи Railway/Render (logs), там будут ошибки Python, сетевые ошибки, и т.д.

---

## 5. Локальная разработка после деплоя

Для разработки вы можете продолжать запускать всё локально:

```bash
# из папки telegram_slot_bot
uvicorn server:app --host 0.0.0.0 --port 8000

# в другом терминале
set TELEGRAM_TOKEN=ВАШ_ТОКЕН
set WEBAPP_URL=http://localhost:8000
python bot.py
```

А на проде (Railway/Render) всё будет работать с постоянным HTTPS‑доменом.
