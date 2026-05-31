import OpenAI from "openai";
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
  apiKey?: string;
  baseURL?: string;
  maxRetries?: number;
};

export function createOpenAI(config?: Config): Provider {
  const client = new OpenAI({
    apiKey: config?.apiKey, // 省略時はOPENAI_API_KEYを自動参照
    baseURL: config?.baseURL,
    maxRetries: config?.maxRetries,
  });

  function convertMessages(messages: Message[]) {
    return messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          tool_call_id: m.toolCallId,
          content: m.content,
        };
      }
      if (m.role === "assistant" && m.toolCalls) {
        return {
          role: "assistant" as const,
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.toolCallId,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) }, // argsはJSON文字列で受け取る仕様なため、stringifyする
          })),
        };
      }
      return { role: m.role, content: m.content };
    });
  }

  function mapFinishReason(reason: string | null) {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      case "tool_calls":
        return "tool_calls";
      default:
        return "stop";
    }
  }

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      const tools = params.tools?.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      try {
        const completion = await client.chat.completions.create(
          {
            model: modelId,
            messages: convertMessages(params.messages),
            temperature: params.temperature,
            max_completion_tokens: params.maxTokens,
            ...(tools && tools.length > 0 && { tools }),
          },
          { signal: params.signal },
        );

        const choice = completion.choices[0];
        if (!choice) {
          throw new LLMApiError(
            500,
            "openai",
            "no_response",
            "APIからの応答がありません",
          );
        }
        const message = choice.message;

        // TODO: functionがないので原因を調べる。おそらくtoolsの配列が渡ってくる？
        const toolCalls: ToolCall[] | undefined = message.tool_calls?.map(
          (tc: any) => ({
            toolCallId: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          }),
        );

        return {
          text: message.content ?? "",
          finishReason: mapFinishReason(choice.finish_reason),
          toolCalls,
          usage: {
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            totalTokens: completion.usage?.total_tokens,
          },
        };
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          throw new LLMApiError(
            error.status ?? 500,
            "openai",
            error.code ?? undefined,
            error.message,
            error,
          );
        }

        throw error;
      }
    },
  });
}
