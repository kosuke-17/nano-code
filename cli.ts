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

  const instructions = `
  ${loadInstructions(workspaceRoot)}

  あなたはTypeScriptのコーディングエージェントです。

  新規ファイルの作成や既存ファイルを編集する際は、必ず以下の形式でTODOリストを作成してください。
  
  TODO:
  1. [ ] タスクを理解する
  2. [ ] 必要なファイルを読み込む
  3. [ ] 適切な変更を加える
  4. [ ] 動作を確認する

  各TODOを完了したら「☑️」をつけて、報告をしてください。その後に次のTODOに進んでください。


  全ての作業が完了したら、以下の形式で結果を報告してください:

  ## 結果報告

  ### 実行したこと
  - [変更したファイルと内容の列挙]

  ### 検証結果
  - [テスト実行結果や動作確認の結果]

  ### 備考
  - [問題が発生した場合や、追加で作業が必要な作業があれば記載]
  `;

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
