import * as readline from "readline";

export async function requestApproval(
  toolName: string,
  args: any,
): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n--- 承認が必要です---");
    console.log(`ツール: ${toolName}`);
    console.log(`引数: ${JSON.stringify(args, null, 2)}`);

    // readline.questionは、ユーザーからの入力を待ち、入力が得られたらコールバック関数を呼び出す。
    // コールバック関数の引数には、ユーザーからの入力が渡される。
    // ユーザーからの入力が得られたら、rl.close()を呼び出してreadlineインターフェースを閉じる。
    // rl.close()を呼び出すと、readlineインターフェースが閉じられ、ユーザーからの入力を待ちなくなる。
    // ユーザーからの入力が得られたら、rl.close()を呼び出してreadlineインターフェースを閉じる。
    rl.question("このツールを実行しますか? (y/n): ", (answer) => {
      rl.close();

      if (answer.toLowerCase() === "y") {
        console.log("承認されました。実行します....");
        resolve(true);
      } else {
        console.log("承認されませんでした。実行を中止します....");
        resolve(false);
      }
    });
  });
}
