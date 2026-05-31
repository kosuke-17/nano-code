import * as fs from "fs/promises";
import * as path from "path";

export type ReactDocSource = {
  title: string;
  url: string;
  category: string;
  sourceDate?: string;
};

export type ReactDocChunk = {
  id: string;
  title: string;
  url: string;
  category: string;
  content: string;
  embedding: number[];
  sourceDate?: string;
};

export type ReactDocStore = {
  schemaVersion: 1;
  embeddingModel: string;
  createdAt: string;
  sources: ReactDocSource[];
  chunks: ReactDocChunk[];
};

export type ReactDocSearchResult = Omit<ReactDocChunk, "embedding"> & {
  score: number;
};

const DEFAULT_STORE_PATH = path.resolve(
  process.cwd(),
  "workspace/.nano-rag/react-docs.json",
);

const DEFAULT_OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

export const DEFAULT_REACT_RAG_MODEL =
  process.env.REACT_RAG_EMBED_MODEL ?? "bge-m3";

type EmbedResponse = {
  embeddings?: number[][];
  embedding?: number[];
  error?: string;
};

export async function embedTexts(
  inputs: string[],
  options: {
    model?: string;
    baseUrl?: string;
  } = {},
): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }

  const model = options.model ?? DEFAULT_REACT_RAG_MODEL;
  const baseUrl = options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;

  const response = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: inputs,
    }),
  });

  if (!response.ok) {
    if (inputs.length > 1) {
      const embeddings: number[][] = [];
      for (const input of inputs) {
        const [embedding] = await embedTexts([input], options);
        if (!embedding) {
          throw new Error("Ollama embedding API returned an empty result");
        }
        embeddings.push(embedding);
      }
      return embeddings;
    }

    const errorText = await response.text();
    throw new Error(
      `Ollama embedding API failed: ${response.status} ${response.statusText} ${errorText}`,
    );
  }

  const data = (await response.json()) as EmbedResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  if (Array.isArray(data.embeddings)) {
    return data.embeddings;
  }

  if (Array.isArray(data.embedding)) {
    return [data.embedding];
  }

  throw new Error("Ollama embedding API returned no embeddings");
}

export async function embedText(
  input: string,
  options: {
    model?: string;
    baseUrl?: string;
  } = {},
): Promise<number[]> {
  const embeddings = await embedTexts([input], options);
  const embedding = embeddings[0];
  if (!embedding) {
    throw new Error("Ollama embedding API returned an empty result");
  }
  return embedding;
}

export async function loadReactDocStore(
  storePath = DEFAULT_STORE_PATH,
): Promise<ReactDocStore> {
  const raw = await fs.readFile(storePath, "utf-8");
  return JSON.parse(raw) as ReactDocStore;
}

export async function saveReactDocStore(
  store: ReactDocStore,
  storePath = DEFAULT_STORE_PATH,
): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}

export async function searchReactDocs(
  query: string,
  options: {
    topK?: number;
    storePath?: string;
    model?: string;
    baseUrl?: string;
  } = {},
): Promise<ReactDocSearchResult[]> {
  const store = await loadReactDocStore(options.storePath);
  const queryEmbedding = await embedText(query, {
    model: options.model ?? store.embeddingModel,
    baseUrl: options.baseUrl,
  });
  const topK = options.topK ?? 5;

  return store.chunks
    .map((chunk) => {
      const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);

      return {
        id: chunk.id,
        title: chunk.title,
        url: chunk.url,
        category: chunk.category,
        content: chunk.content,
        sourceDate: chunk.sourceDate,
        score: semanticScore + keywordBoost(query, chunk),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function keywordBoost(query: string, chunk: ReactDocChunk): number {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return 0;
  }

  const title = chunk.title.toLowerCase();
  const url = chunk.url.toLowerCase();
  const content = chunk.content.toLowerCase();

  let boost = 0;
  for (const term of terms) {
    const weight = keywordWeight(term);
    if (weight === 0) {
      continue;
    }

    if (title.includes(term)) {
      boost += 0.2 * weight;
    }
    if (url.includes(term)) {
      boost += 0.08 * weight;
    }
    if (content.includes(term)) {
      boost += 0.03 * weight;
    }
  }

  return Math.min(boost, 0.35);
}

function tokenize(query: string): string[] {
  const matches =
    query
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9._-]*|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu) ??
    [];

  return Array.from(new Set(matches)).filter((term) => term.length > 1);
}

function keywordWeight(term: string): number {
  if (term === "react") {
    return 0;
  }

  if (/^\d+(\.\d+)*$/.test(term)) {
    return 0.15;
  }

  if (term.length <= 2) {
    return 0;
  }

  return 1;
}
