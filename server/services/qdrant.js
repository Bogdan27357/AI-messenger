/**
 * Интеграция с Qdrant — векторная база данных
 * Используется для семантического поиска по рабочим документам
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'prm_documents';
const VECTOR_SIZE = 768; // nomic-embed-text default

async function ensureCollection() {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    if (res.ok) return true;

    // Create collection
    const createRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine'
        }
      })
    });
    return createRes.ok;
  } catch (error) {
    console.error('Qdrant error:', error.message);
    return false;
  }
}

async function upsertDocument(id, vector, payload) {
  try {
    await ensureCollection();
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [{
          id,
          vector,
          payload
        }]
      })
    });
    return res.ok;
  } catch (error) {
    console.error('Qdrant upsert error:', error.message);
    return false;
  }
}

async function searchSimilar(vector, limit = 5) {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector,
        limit,
        with_payload: true
      })
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.result || [];
  } catch (error) {
    console.error('Qdrant search error:', error.message);
    return [];
  }
}

async function deleteDocument(id) {
  try {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [id]
      })
    });
  } catch (error) {
    console.error('Qdrant delete error:', error.message);
  }
}

async function checkQdrantStatus() {
  try {
    const res = await fetch(`${QDRANT_URL}/collections`);
    if (!res.ok) return { status: 'error', message: 'Qdrant не отвечает' };
    const data = await res.json();
    return { status: 'ok', collections: data.result?.collections?.length || 0 };
  } catch {
    return { status: 'error', message: 'Не удалось подключиться к Qdrant' };
  }
}

module.exports = { ensureCollection, upsertDocument, searchSimilar, deleteDocument, checkQdrantStatus };
