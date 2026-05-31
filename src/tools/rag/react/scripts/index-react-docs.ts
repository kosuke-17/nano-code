import {
  DEFAULT_REACT_RAG_MODEL,
  type ReactDocChunk,
  type ReactDocSource,
  type ReactDocStore,
  embedTexts,
  saveReactDocStore,
} from "..";

const REACT_DOC_SOURCES: ReactDocSource[] = [
  {
    title: "React 19.2",
    url: "https://react.dev/blog/2025/10/01/react-19-2",
    category: "release",
    sourceDate: "2025-10-01",
  },
  {
    title: "React Versions",
    url: "https://react.dev/versions",
    category: "release",
  },
  {
    title: "React 19",
    url: "https://react.dev/blog/2024/12/05/react-19",
    category: "release",
    sourceDate: "2024-12-05",
  },
  {
    title: "React 19 Upgrade Guide",
    url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
    category: "migration",
    sourceDate: "2024-04-25",
  },
  {
    title: "Sunsetting Create React App",
    url: "https://react.dev/blog/2025/02/14/sunsetting-create-react-app",
    category: "project-setup",
    sourceDate: "2025-02-14",
  },
  {
    title: "Start a New React Project",
    url: "https://react.dev/learn/start-a-new-react-project",
    category: "project-setup",
  },
  {
    title: "Using TypeScript",
    url: "https://react.dev/learn/typescript",
    category: "typescript",
  },
  {
    title: "React Compiler v1.0",
    url: "https://react.dev/blog/2025/10/07/react-compiler-1",
    category: "compiler",
    sourceDate: "2025-10-07",
  },
  {
    title: "Critical Security Vulnerability in React Server Components",
    url: "https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components",
    category: "security",
    sourceDate: "2025-12-03",
  },
  {
    title: "Denial of Service and Source Code Exposure in React Server Components",
    url: "https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components",
    category: "security",
    sourceDate: "2025-12-11",
  },
  {
    title: "useEffectEvent",
    url: "https://react.dev/reference/react/useEffectEvent",
    category: "api",
  },
  {
    title: "Activity",
    url: "https://react.dev/reference/react/Activity",
    category: "api",
  },
  {
    title: "ViewTransition",
    url: "https://react.dev/reference/react/ViewTransition",
    category: "api",
  },
  {
    title: "cache",
    url: "https://react.dev/reference/react/cache",
    category: "api",
  },
  {
    title: "cacheSignal",
    url: "https://react.dev/reference/react/cacheSignal",
    category: "api",
  },
  {
    title: "use",
    url: "https://react.dev/reference/react/use",
    category: "api",
  },
  {
    title: "useActionState",
    url: "https://react.dev/reference/react/useActionState",
    category: "api",
  },
  {
    title: "useOptimistic",
    url: "https://react.dev/reference/react/useOptimistic",
    category: "api",
  },
  {
    title: "React Compiler",
    url: "https://react.dev/learn/react-compiler",
    category: "compiler",
  },
  {
    title: "React Compiler configuration",
    url: "https://react.dev/reference/react-compiler/configuration",
    category: "compiler",
  },
  {
    title: "React Compiler directives",
    url: "https://react.dev/reference/react-compiler/directives",
    category: "compiler",
  },
  {
    title: "Server Components",
    url: "https://react.dev/reference/rsc/server-components",
    category: "rsc",
  },
  {
    title: "'use client'",
    url: "https://react.dev/reference/rsc/use-client",
    category: "rsc",
  },
  {
    title: "'use server'",
    url: "https://react.dev/reference/rsc/use-server",
    category: "rsc",
  },
  {
    title: "Server Functions",
    url: "https://react.dev/reference/rsc/server-functions",
    category: "rsc",
  },
  {
    title: "<form>",
    url: "https://react.dev/reference/react-dom/components/form",
    category: "react-dom",
  },
  {
    title: "Rules of Hooks",
    url: "https://react.dev/reference/rules/rules-of-hooks",
    category: "rules",
  },
  {
    title: "Components and Hooks must be pure",
    url: "https://react.dev/reference/rules/components-and-hooks-must-be-pure",
    category: "rules",
  },
  {
    title: "You Might Not Need an Effect",
    url: "https://react.dev/learn/you-might-not-need-an-effect",
    category: "patterns",
  },
  {
    title: "Removing Effect Dependencies",
    url: "https://react.dev/learn/removing-effect-dependencies",
    category: "patterns",
  },
];

const CHUNK_SIZE = 2400;
const CHUNK_OVERLAP = 350;
const EMBED_BATCH_SIZE = 1;

async function main(): Promise<void> {
  const embeddingModel = process.env.REACT_RAG_EMBED_MODEL ?? DEFAULT_REACT_RAG_MODEL;
  const chunksWithoutEmbeddings: Omit<ReactDocChunk, "embedding">[] = [];

  console.log(`Indexing ${REACT_DOC_SOURCES.length} React official pages`);
  console.log(`Embedding model: ${embeddingModel}`);

  for (const source of REACT_DOC_SOURCES) {
    console.log(`Fetching: ${source.title}`);
    const html = await fetchText(source.url);
    const text = extractMainText(html);
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

    chunks.forEach((content, index) => {
      chunksWithoutEmbeddings.push({
        id: `${slugify(source.title)}-${index + 1}`,
        title: source.title,
        url: source.url,
        category: source.category,
        content,
        sourceDate: source.sourceDate,
      });
    });
  }

  const chunks: ReactDocChunk[] = [];

  for (let i = 0; i < chunksWithoutEmbeddings.length; i += EMBED_BATCH_SIZE) {
    const batch = chunksWithoutEmbeddings.slice(i, i + EMBED_BATCH_SIZE);
    console.log(
      `Embedding chunks ${i + 1}-${Math.min(
        i + batch.length,
        chunksWithoutEmbeddings.length,
      )}/${chunksWithoutEmbeddings.length}`,
    );

    const embeddings = await embedTexts(
      batch.map((chunk) => searchableText(chunk)),
      { model: embeddingModel },
    );

    batch.forEach((chunk, index) => {
      const embedding = embeddings[index];
      if (!embedding) {
        throw new Error(`Missing embedding for chunk ${chunk.id}`);
      }
      chunks.push({ ...chunk, embedding });
    });
  }

  const store: ReactDocStore = {
    schemaVersion: 1,
    embeddingModel,
    createdAt: new Date().toISOString(),
    sources: REACT_DOC_SOURCES,
    chunks,
  };

  await saveReactDocStore(store);
  console.log(`Saved ${chunks.length} chunks to workspace/.nano-rag/react-docs.json`);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "nano-code-react-rag/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return await response.text();
}

function extractMainText(html: string): string {
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  const body = mainMatch?.[0] ?? html;

  const text = decodeHtmlEntities(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<pre[\s\S]*?<\/pre>/gi, (value) => `\n${stripTags(value)}\n`)
      .replace(/<\/(h1|h2|h3|h4|p|li|pre|blockquote|code)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );

  const withoutCopyright =
    text.split("Copyright © Meta Platforms, Inc")[0] ?? text;

  return withoutCopyright
    .replace(/no uwu plz uwu\?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(input: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return input.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, entity) => {
    const value = String(entity).toLowerCase();
    if (value.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(value.slice(2), 16));
    }
    if (value.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(value.slice(1), 10));
    }
    return entities[value] ?? match;
  });
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 80);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length <= chunkSize) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length > chunkSize) {
      chunks.push(...splitLongText(paragraph, chunkSize, overlap));
      current = "";
      continue;
    }

    const previousTail = current.slice(Math.max(0, current.length - overlap));
    current = previousTail ? `${previousTail}\n\n${paragraph}` : paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function splitLongText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) {
      break;
    }
    start = Math.max(0, end - overlap);
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function searchableText(chunk: Omit<ReactDocChunk, "embedding">): string {
  return [
    `Title: ${chunk.title}`,
    `Category: ${chunk.category}`,
    chunk.sourceDate ? `Date: ${chunk.sourceDate}` : "",
    `URL: ${chunk.url}`,
    chunk.content,
  ]
    .filter(Boolean)
    .join("\n");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
