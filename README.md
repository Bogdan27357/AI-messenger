# AI Music Recommender

Музыкальное приложение с ИИ-рекомендациями на базе Ollama.

## Возможности

- Прослушивание бесплатной музыки через Jamendo API
- ИИ-рекомендации на основе истории прослушиваний (Ollama)
- Поиск треков и фильтрация по жанрам
- Современный дизайн с фоновой картинкой
- Полнофункциональный аудиоплеер

## Запуск

### 1. Установите зависимости

```bash
npm install
```

### 2. Установите и запустите Ollama

```bash
# Установка: https://ollama.com
ollama pull llama3
ollama serve
```

### 3. Запустите приложение

```bash
npm start
```

Откройте http://localhost:3000

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | 3000 | Порт сервера |
| `OLLAMA_URL` | http://localhost:11434 | URL Ollama |
| `OLLAMA_MODEL` | llama3 | Модель Ollama |
| `JAMENDO_CLIENT_ID` | b6747d04 | Client ID для Jamendo API |

## Технологии

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JS, CSS3
- **Музыка**: Jamendo API (бесплатно)
- **ИИ**: Ollama (локальный LLM)
