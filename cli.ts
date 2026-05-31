import * as path from "path";
import { loadInstructions } from "./src/core/prompt";
import { createModelFromEnv } from "./src/providers/modelFactory";
import { Agent } from "./src/core/agent";
import { tools as fileOperationTools } from "./src/tools/file-operation";

const [readFile, writeFile, editFile, execCommand] = fileOperationTools;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('使い方: bun run agent "タスクの説明"');
    console.error('例: bun run agent "test/app.tsにAppコンポーネントを書いて"');
    process.exit(1);
  }

  const userPrompt = args.join(" ");
  const model = createModelFromEnv();

  const workspaceRoot = path.resolve(process.cwd(), "workspace");

  const instructions = loadInstructions(workspaceRoot);

  const agent = new Agent({
    name: "nano-code",
    instructions,
    model,
    tools: {
      readFile,
      writeFile,
      editFile,
      execCommand,
    },
  });

  console.log("エージェント起動\n");
  console.log(`タスク: ${userPrompt}`);
  console.log("--".repeat(40) + "\n");

  try {
    const result = await agent.generate(userPrompt);
    console.log(result.text);
    console.log("\n" + "--".repeat(40));
    console.log("タスク完了");
  } catch (error) {
    console.error("\n予期しないエラー:");
    console.error(error instanceof Error ? error.message : "不明なエラー");
    process.exit(1);
  }
}

main();
