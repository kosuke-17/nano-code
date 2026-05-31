import {
  LLMApiError,
  type GenerateParams,
  type GenerateTextResult,
  type LanguageModel,
  type Message,
  type Provider,
  type ToolCall,
} from "../tools/file-operation/type";

type Config = {
  baseURL?: string;
};

type OllamaTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OllamaToolCall = {
  type?: "function";
  function: {
    index?: number;
    name: string;
    arguments?: Record<string, unknown> | string | null;
  };
};

type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

const PROVIDER_NAME = "ollama";

export function createOllama(config?: Config): Provider {
  const baseURL = trimTrailingSlash(config?.baseURL ?? "http://localhost:11434");

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      const tools = params.tools?.map(
        (tool): OllamaTool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }),
      );

      const options: Record<string, unknown> = {};
      if (params.temperature !== undefined) {
        options.temperature = params.temperature;
      }
      if (params.maxTokens !== undefined) {
        options.num_predict = params.maxTokens;
      }

      const response = await fetch(`${baseURL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: convertMessages(params.messages),
          stream: false,
          ...(tools && tools.length > 0 && { tools }),
          ...(Object.keys(options).length > 0 && { options }),
        }),
        signal: params.signal,
      });

      const data = await parseJsonResponse(response);
      if (!response.ok) {
        throw new LLMApiError(
          response.status,
          PROVIDER_NAME,
          undefined,
          getErrorMessage(data, response.statusText),
          data,
        );
      }

      if (isRecord(data) && typeof data.error === "string") {
        throw new LLMApiError(
          response.status >= 400 ? response.status : 500,
          PROVIDER_NAME,
          undefined,
          data.error,
          data,
        );
      }

      const completion = isRecord(data)
        ? (data as OllamaChatResponse)
        : undefined;
      const message = completion?.message;
      if (!message) {
        throw new LLMApiError(
          500,
          PROVIDER_NAME,
          "no_response",
          "Ollama APIからの応答がありません",
          data,
        );
      }

      const toolCalls = message.tool_calls?.map(convertToolCall);

      return {
        text: message.content ?? "",
        finishReason: mapFinishReason(completion?.done_reason, toolCalls),
        toolCalls,
        usage: {
          promptTokens: completion?.prompt_eval_count,
          completionTokens: completion?.eval_count,
          totalTokens: sumTokens(
            completion?.prompt_eval_count,
            completion?.eval_count,
          ),
        },
      };
    },
  });
}

function convertMessages(messages: Message[]): OllamaMessage[] {
  return messages.map((message): OllamaMessage => {
    if (message.role === "tool") {
      return {
        role: "tool",
        tool_name: message.name,
        content: message.content,
      };
    }

    if (message.role === "assistant" && message.toolCalls) {
      return {
        role: "assistant",
        ...(message.content && { content: message.content }),
        tool_calls: message.toolCalls.map((toolCall, index) => ({
          type: "function",
          function: {
            index,
            name: toolCall.name,
            arguments: toolCall.args,
          },
        })),
      };
    }

    return { role: message.role, content: message.content };
  });
}

function convertToolCall(toolCall: OllamaToolCall, index: number): ToolCall {
  return {
    toolCallId: `ollama-tool-call-${index}`,
    name: toolCall.function.name,
    args: parseToolArguments(toolCall.function.arguments),
  };
}

function parseToolArguments(
  args: OllamaToolCall["function"]["arguments"],
): Record<string, unknown> {
  if (args === undefined || args === null) {
    return {};
  }

  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      return isRecord(parsed) ? parsed : {};
    } catch (error) {
      throw new LLMApiError(
        500,
        PROVIDER_NAME,
        "invalid_tool_arguments",
        "Ollama tool call arguments are not valid JSON",
        error,
      );
    }
  }

  return args;
}

function mapFinishReason(
  reason: string | undefined,
  toolCalls: ToolCall[] | undefined,
): GenerateTextResult["finishReason"] {
  if (toolCalls && toolCalls.length > 0) {
    return "tool_calls";
  }

  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    default:
      return "stop";
  }
}

function sumTokens(
  promptTokens: number | undefined,
  completionTokens: number | undefined,
): number | undefined {
  if (promptTokens === undefined || completionTokens === undefined) {
    return undefined;
  }

  return promptTokens + completionTokens;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (isRecord(data) && typeof data.error === "string") {
    return data.error;
  }

  if (typeof data === "string" && data.length > 0) {
    return data;
  }

  return fallback || "Ollama API request failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
