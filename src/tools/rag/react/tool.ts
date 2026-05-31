import type { Tool } from "../../file-operation/type";
import { searchReactDocs } from "./store";

async function reactDocsSearchExecute(args: {
  query: string;
  topK?: number;
}): Promise<string> {
  const topK = typeof args.topK === "number" ? args.topK : 5;

  try {
    const results = await searchReactDocs(args.query, { topK });

    if (results.length === 0) {
      return "React docs RAG index returned no results.";
    }

    return results
      .map((result, index) => {
        const sourceDate = result.sourceDate
          ? `\nDate: ${result.sourceDate}`
          : "";

        return [
          `#${index + 1} ${result.title}`,
          `Score: ${result.score.toFixed(4)}`,
          `Category: ${result.category}${sourceDate}`,
          `URL: ${result.url}`,
          "Excerpt:",
          result.content,
        ].join("\n");
      })
      .join("\n\n---\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return [
      `React docs RAG search failed: ${message}`,
      "If the index is missing, run `bun run rag:react:index` after starting Ollama and pulling the embedding model.",
    ].join("\n");
  }
}

export const reactDocsSearch: Tool = {
  name: "reactDocsSearch",
  description:
    "Search the local React 2025+ official-docs RAG index. Intended for opt-in React-specific agents, not the default file-editing tool set.",
  needsApproval: false,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Natural language search query about current React usage, APIs, or patterns.",
      },
      topK: {
        type: "number",
        description: "Maximum number of matching chunks to return. Default: 5.",
      },
    },
    required: ["query"],
  },
  execute: reactDocsSearchExecute as Tool["execute"],
};
