import { createOpenAI } from "./openai";
import { createOllama } from "./ollama";
import type { LanguageModel } from "../tools/file-operation/type";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export function createModelFromEnv(): LanguageModel {
  const provider = process.env.LLM_PROVIDER;
  const modelName = process.env.LLM_MODEL;

  if (!provider) {
    throw new Error("LLM_PROVIDER が設定されていません。");
  }

  if (!modelName) {
    throw new Error("LLM_MODEL が設定されていません。");
  }

  switch (provider) {
    case "openai": {
      const apiKey = process.env.LLM_API_KEY;
      if (!apiKey) {
        throw new Error("LLM_PROVIDER=openai の場合、LLM_API_KEY が必要です。");
      }
      const openai = createOpenAI({ apiKey });
      return openai(modelName);
    }
    case "ollama": {
      const baseURL = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
      const ollama = createOllama({ baseURL });
      return ollama(modelName);
    }
    default:
      throw new Error(`未対応のプロバイダー: ${provider}`);
  }
}
