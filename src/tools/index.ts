import { execCommand } from "./execCommand";
import { readFile } from "./readFile";
import { writeFile } from "./writeFile";
import { editFile } from "./editFile";

export const tools = [execCommand, readFile, writeFile, editFile];
