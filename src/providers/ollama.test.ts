import { afterEach, describe, expect, test } from "bun:test";
import { LLMApiError } from "../tools/file-operation/type";
import { createModelFromEnv } from "./modelFactory";
import { createOllama } from "./ollama";

const originalFetch = globalThis.fetch;
const originalEnv = {
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_MODEL: process.env.LLM_MODEL,
  LLM_API_KEY: process.env.LLM_API_KEY,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
};

describe("createOllama", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv("LLM_PROVIDER", originalEnv.LLM_PROVIDER);
    restoreEnv("LLM_MODEL", originalEnv.LLM_MODEL);
    restoreEnv("LLM_API_KEY", originalEnv.LLM_API_KEY);
    restoreEnv("OLLAMA_BASE_URL", originalEnv.OLLAMA_BASE_URL);
  });

  test("posts native chat requests with generation options", async () => {
    let requestedUrl = "";
    let requestedBody: any;

    mockFetch(async (input, init) => {
      requestedUrl = String(input);
      requestedBody = JSON.parse(init?.body as string);

      return jsonResponse({
        message: { content: "pong" },
        done_reason: "stop",
        prompt_eval_count: 2,
        eval_count: 3,
      });
    });

    const model = createOllama({ baseURL: "http://localhost:11434/" })("qwen3");
    const result = await model.doGenerate({
      messages: [{ role: "user", content: "ping" }],
      temperature: 0.2,
      maxTokens: 32,
    });

    expect(requestedUrl).toBe("http://localhost:11434/api/chat");
    expect(requestedBody).toEqual({
      model: "qwen3",
      messages: [{ role: "user", content: "ping" }],
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 32,
      },
    });
    expect(result).toEqual({
      text: "pong",
      finishReason: "stop",
      toolCalls: undefined,
      usage: {
        promptTokens: 2,
        completionTokens: 3,
        totalTokens: 5,
      },
    });
  });

  test("maps native tool calls and tool messages", async () => {
    let requestedBody: any;

    mockFetch(async (_input, init) => {
      requestedBody = JSON.parse(init?.body as string);

      return jsonResponse({
        message: {
          content: "",
          tool_calls: [
            {
              type: "function",
              function: {
                index: 0,
                name: "read_file",
                arguments: { path: "README.md" },
              },
            },
          ],
        },
        done_reason: "stop",
      });
    });

    const model = createOllama()("qwen3");
    const result = await model.doGenerate({
      messages: [
        { role: "user", content: "read the README" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              toolCallId: "previous-call",
              name: "read_file",
              args: { path: "README.md" },
            },
          ],
        },
        {
          role: "tool",
          toolCallId: "previous-call",
          name: "read_file",
          content: "contents",
        },
      ],
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          needsApproval: false,
          parameters: {
            type: "object",
            required: ["path"],
            properties: { path: { type: "string" } },
          },
          execute: async () => "contents",
        },
      ],
    });

    expect(requestedBody.tools[0].function.name).toBe("read_file");
    expect(requestedBody.messages[1]).toEqual({
      role: "assistant",
      tool_calls: [
        {
          type: "function",
          function: {
            index: 0,
            name: "read_file",
            arguments: { path: "README.md" },
          },
        },
      ],
    });
    expect(requestedBody.messages[2]).toEqual({
      role: "tool",
      tool_name: "read_file",
      content: "contents",
    });
    expect(result.finishReason).toBe("tool_calls");
    expect(result.toolCalls).toEqual([
      {
        toolCallId: "ollama-tool-call-0",
        name: "read_file",
        args: { path: "README.md" },
      },
    ]);
  });

  test("throws LLMApiError for Ollama HTTP errors", async () => {
    mockFetch(async () => jsonResponse({ error: "model not found" }, 404));

    const model = createOllama()("missing-model");
    let error: unknown;

    try {
      await model.doGenerate({
        messages: [{ role: "user", content: "hello" }],
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(LLMApiError);
    expect((error as LLMApiError).status).toBe(404);
    expect((error as LLMApiError).provider).toBe("ollama");
    expect((error as Error).message).toBe("model not found");
  });

  test("throws LLMApiError for Ollama response error fields", async () => {
    mockFetch(async () => jsonResponse({ error: "model is loading" }));

    const model = createOllama()("loading-model");
    let error: unknown;

    try {
      await model.doGenerate({
        messages: [{ role: "user", content: "hello" }],
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(LLMApiError);
    expect((error as LLMApiError).status).toBe(500);
    expect((error as LLMApiError).provider).toBe("ollama");
    expect((error as Error).message).toBe("model is loading");
  });

  test("model factory uses native Ollama provider without an API key", async () => {
    process.env.LLM_PROVIDER = "ollama";
    process.env.LLM_MODEL = "qwen3";
    delete process.env.LLM_API_KEY;
    delete process.env.OLLAMA_BASE_URL;

    let requestedUrl = "";
    mockFetch(async (input) => {
      requestedUrl = String(input);
      return jsonResponse({ message: { content: "ok" }, done_reason: "stop" });
    });

    const model = createModelFromEnv();
    await model.doGenerate({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(requestedUrl).toBe("http://localhost:11434/api/chat");
  });
});

function mockFetch(
  handler: (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => Promise<Response>,
) {
  globalThis.fetch = handler as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
