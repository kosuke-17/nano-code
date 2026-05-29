import { createOpenAI } from "./src/providers/openai";
import { generateText } from "./src/core/generate-text";
import type { Message, Tool } from "./src/type";
import { writeFile } from "./src/tools/writeFile";
import { readFile } from "./src/tools/readFile";
import { editFile } from "./src/tools/editFile";
import { execCommand } from "./src/tools/execCommand";
import { tools } from "./src/tools";
import { requestApproval } from "./src/core/approval";
import { Agent } from "./src/core/agent";

// const messages: Message[] = [
//   { role: "user", content: "AIエージェントとは何ですか？" },
// ];

// const openai = createOpenAI();

// const model = openai("gpt-4o-mini");
// const result = await generateText({ model, messages });

// console.log(result);

// const PATH_TO_TEST_FILE = "test.txt";

// async function demo() {
//   console.log("=== ツール動作確認 ===");

//   console.log("1. writeFile: テストファイルを作成");
//   const writeResult = await writeFile.execute({
//     path: PATH_TO_TEST_FILE,
//     content: "こんにちは from Nano Code! \n これはテストファイルです",
//   });

//   console.log("2. readFile: テストファイルを読み込み");
//   const readResult = await readFile.execute({
//     path: PATH_TO_TEST_FILE,
//   });
//   console.log(readResult);

//   console.log("3. editFile: テストファイルを編集");
//   const editResult = await editFile.execute({
//     path: PATH_TO_TEST_FILE,
//     oldText: "テストファイル",
//     newText: "テストファイルを編集しました",
//   });
//   console.log(`内容を編集しました: ${editResult}`);

//   console.log("4. readFile: テストファイルを読み込み");
//   const readResult2 = await readFile.execute({
//     path: PATH_TO_TEST_FILE,
//   });
//   console.log(`編集後の内容: ${readResult2}`);

//   console.log("5. execCommand: テストファイルを実行");
//   const execResult = await execCommand.execute({
//     command: "ls -la",
//   });
//   console.log(`コマンド実行結果: ${execResult}`);

//   console.log("6. エラーケース: 存在しないファイルの読み込み");

//   try {
//     const readResult3 = await readFile.execute({
//       path: "nonexistent.txt",
//     });
//     console.log(`読み込み結果: ${readResult3}`);
//   } catch (error) {
//     console.error(
//       `エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
//     );
//   }

//   console.log(
//     "7. セキュリティチェック: ワークスペース外のファイルへのアクセス",
//   );

//   try {
//     await readFile.execute({
//       path: "../.env",
//     });
//   } catch (error) {
//     console.error(
//       `期待通りのエラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
//     );
//   }
// }

// demo();

// 対話モード
// const messages: Message[] = [
//   { role: "system", content: "あなたは親切なアシスタントです。" },
//   { role: "user", content: "2 + 2 + 100はいくつですか?" },
// ];

// const openai = createOpenAI();

// const model = openai("gpt-4o-mini");

// while (true) {
//   const response = await generateText({ model, messages });

//   console.log(response.text);

//   messages.push({ role: "assistant", content: response.text });

//   if (response.finishReason === "stop") {
//     console.log("対話を終了します。");
//     break;
//   }
// }

// ツール動作確認
//

// コーディングエージェント
const openai = createOpenAI();
const model = openai("gpt-4o-mini");

const codingAgent = new Agent({
  name: "nano-code",
  instructions:
    "あなたはコーディングエージェントです。慎重に作業してください。",
  model,
  tools: {
    readFile,
    writeFile,
    editFile,
    execCommand,
  },
  maxSteps: 20,
  verbose: true,
});

const result = await codingAgent.generate(
  "test/app.tsにAppコンポーネントを書いて",
);

console.log(result.text);
