# Pulkovo AI Platform — API Documentation

## Аутентификация

### POST /api/auth/login
Авторизация пользователя.

**Body:** `{"username": "string", "password": "string"}`
**Response:** `{"access_token": "string", "refresh_token": "string", "token_type": "bearer"}`

### POST /api/auth/register
Регистрация нового пользователя.

**Body:** `{"username": "string", "full_name": "string", "email": "string", "password": "string", "department": "string", "role": "user"}`

### POST /api/auth/refresh
Обновление токена.

**Body:** `{"refresh_token": "string"}`

### GET /api/auth/me
Текущий пользователь. Требует JWT.

---

## Шаблоны

### GET /api/templates/
Список доступных шаблонов (фильтр по отделу).

### GET /api/templates/{slug}
Получить шаблон по slug.

### GET /api/templates/meta/{slug}
Получить meta.json шаблона (поля для формы).

### POST /api/templates/
Создать шаблон (manager/admin).

---

## Документы

### POST /api/documents/generate
Генерация документа по шаблону.

**Body:** `{"template_slug": "string", "fields": {}}`
**Поток:** Заполнение полей → ИИ (Ollama) → docxtpl → Категоризация → Сохранение в 1С → Ответ

### GET /api/documents/
Список документов.

### GET /api/documents/{doc_id}
Получить документ.

### GET /api/documents/{doc_id}/download
Скачать .docx файл.

---

## Чат (RAG)

### POST /api/chat/message
Отправка сообщения. `stream: true` → Server-Sent Events.

**Body:** `{"message": "string", "stream": true}`

### POST /api/chat/knowledge/upload
Загрузка документа в базу знаний (manager/admin).

### GET /api/chat/knowledge/stats
Статистика базы знаний.

---

## 1С Интеграция

### GET /api/1c/counterparties?q=...
Поиск контрагентов.

### GET /api/1c/flights?date=...
Рейсы по дате.

### GET /api/1c/employees?dept=...
Сотрудники по отделу.

### GET /api/1c/stats
Счётчики справочников.

### GET /api/1c/sync-log
Лог синхронизации.

---

## Диадок (ЭДО)

### POST /api/diadoc/check
ИИ-проверка документа перед отправкой.

**Body:** `{"document_id": "uuid"}`

### POST /api/diadoc/send
Отправка документа в Диадок.

**Body:** `{"document_id": "uuid", "counterparty_inn": "string"}`

### GET /api/diadoc/status/{message_id}
Статус документооборота.

### GET /api/diadoc/queue
Очередь документов.

---

## Аналитика

### GET /api/analytics/dashboard
Данные дашборда: документы сегодня, статистика по отделам, последние документы, GPU.

---

## Health

### GET /api/health
`{"status": "ok", "service": "Pulkovo AI Platform"}`
