import { createOpenAI } from "./openai";
import type { LanguageModel, Provider } from "../type";

export function createModelFromEnv(): LanguageModel {
  const provider = process.env.LLM_PROVIDER;
  const modelName = process.env.LLM_MODEL;
  const apiKey = process.env.LLM_API_KEY;

  if (!provider || !modelName || !apiKey) {
    throw new Error(
      "LLM_PROVIDER, LLM_MODEL, LLM_API_KEYが設定されていません。",
    );
  }

  switch (provider) {
    case "openai":
      const openai = createOpenAI();
      return openai(modelName);
    case "ollama":
      throw new Error(`未対応のプロバイダー: ${provider}`);
    default:
      throw new Error(`未対応のプロバイダー: ${provider}`);
  }

  throw new Error(`未対応のプロバイダー: ${provider}`);
}
