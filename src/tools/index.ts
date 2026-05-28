import { execCommand } from "./execCommand";
import { readFile } from "./readFile";
import { writeFile } from "./writeFile";
import { editFile } from "./editFile";
import type { Tool } from "../type";

export const tools: Tool[] = [
  execCommand as unknown as Tool,
  readFile as unknown as Tool,
  writeFile as unknown as Tool,
  editFile as unknown as Tool,
];
