import { createOpenAI } from "./src/providers/openai";
import { generateText } from "./src/core/generate-text";
import type { Message } from "./src/type";

const messages: Message[] = [
  { role: "user", content: "AIエージェントとは何ですか？" },
];

const openai = createOpenAI();

const model = openai("gpt-4o-mini");
const result = await generateText({ model, messages });

console.log(result);
