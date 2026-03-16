import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';

const COLLECTION_NAME = 'knowledge_docs';
const VECTOR_SIZE = 768; // nomic-embed-text dimension

let client: QdrantClient;

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: config.qdrant.url });
  }
  return client;
}

export async function ensureCollection(): Promise<void> {
  const qdrant = getClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    console.log(`Qdrant collection "${COLLECTION_NAME}" created`);
  }
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${config.ollama.url}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.embedModel,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embed error: ${response.status}`);
  }

  const data: any = await response.json();
  return data.embeddings[0];
}

export async function upsertDocument(
  id: string,
  title: string,
  content: string
): Promise<void> {
  const qdrant = getClient();
  const text = `${title}\n\n${content}`;
  const vector = await getEmbedding(text);

  await qdrant.upsert(COLLECTION_NAME, {
    points: [
      {
        id,
        vector,
        payload: { title, content },
      },
    ],
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const qdrant = getClient();
  await qdrant.delete(COLLECTION_NAME, {
    points: [id],
  });
}

export async function searchDocuments(
  query: string,
  limit: number = 5
): Promise<Array<{ id: string; title: string; content: string; score: number }>> {
  const qdrant = getClient();
  const vector = await getEmbedding(query);

  const results = await qdrant.search(COLLECTION_NAME, {
    vector,
    limit,
    score_threshold: 0.3,
  });

  return results.map((r) => ({
    id: r.id as string,
    title: (r.payload?.title as string) || '',
    content: (r.payload?.content as string) || '',
    score: r.score,
  }));
}
