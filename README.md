# /nano-code

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## React Local RAG

This project can build a local React official-docs index for coding tasks.

```bash
ollama pull bge-m3
bun run rag:react:index
bun run rag:react:search "React 19 form actions"
```

RAG code, including its scripts, is isolated under `src/rag/react` and is not part of the default `src/tools` file-editing tool set. Use the `rag:react:*` scripts for manual lookup, or explicitly import `reactDocsSearch` from `src/rag/react` in a React-specific agent.

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
