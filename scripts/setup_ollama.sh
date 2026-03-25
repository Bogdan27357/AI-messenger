#!/bin/bash
# Script to pull required Ollama models

set -e

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "=== MAS AI System: Ollama Model Setup ==="
echo "Ollama host: $OLLAMA_HOST"

# Wait for Ollama to be available
echo "Waiting for Ollama server..."
for i in {1..30}; do
    if curl -s "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
        echo "Ollama is ready!"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 5
done

# Pull models
echo ""
echo "=== Pulling embedding model ==="
ollama pull nomic-embed-text

echo ""
echo "=== Pulling fast model (7B) ==="
ollama pull qwen2.5:7b

echo ""
echo "=== Pulling primary model (32B) ==="
echo "NOTE: This requires ~20GB of disk space and ~24GB GPU VRAM"
ollama pull qwen2.5:32b

echo ""
echo "=== Pulling vision model ==="
ollama pull llava:13b

echo ""
echo "=== Setup complete! ==="
ollama list
