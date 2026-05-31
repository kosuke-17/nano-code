import type { Tool } from "../../file-operation/type";
import { reactDocsSearch } from "./tool";

export * from "./store";
export * from "./tool";

export const tools: Tool[] = [reactDocsSearch as unknown as Tool];
