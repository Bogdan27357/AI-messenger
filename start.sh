#!/bin/bash

echo "🎵 AI Music Recommender — Запуск..."

# Установка зависимостей если нет node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 Установка зависимостей..."
  npm install
fi

# Проверка Ollama
if command -v ollama &> /dev/null; then
  if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "🤖 Запуск Ollama..."
    ollama serve &> /dev/null &
    sleep 2
  fi
  # Скачать модель если нет
  if ! ollama list 2>/dev/null | grep -q "llama3"; then
    echo "⬇️  Скачиваю модель llama3..."
    ollama pull llama3
  fi
else
  echo "⚠️  Ollama не установлена. ИИ-рекомендации будут недоступны."
  echo "   Установить: https://ollama.com"
fi

echo "🚀 Запуск сервера..."
echo "   Откройте: http://localhost:3000"
node server.js
