import { spawn } from "child_process";
import * as path from "path";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace");

const ALLOWED_COMMANDS = ["bun", "ls", "git", "gh"];

const MAX_OUTPUT_LENGTH = 2048;

const dangerousChars = /[;%`]/;

type Quote = '"' | "'" | null;

export function parseCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: Quote = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;

    // クウォートの処理
    if (quote) {
      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }

      if (ch === "\\" && quote === '"') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    }

    current += ch;
  }

  if (quote) {
    throw new Error("クウォートが閉じられていません: quote");
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

async function execCommandExecute(args: { command: string }): Promise<string> {
  // 危険文字チェック
  if (dangerousChars.test(args.command)) {
    throw new Error("コマンド連結、置換文字を含むコマンドは実行できません");
  }

  const parts = parseCommand(args.command);
  if (parts.length === 0) {
    throw new Error("コマンドがからです");
  }

  // コマンドの解析
  const commandName = parts[0] as string;
  const commandArgs = parts.slice(1);

  // ホワイトリストチェック
  if (!ALLOWED_COMMANDS.includes(commandName)) {
    throw new Error(`${commandName}は許可されていません`);
  }

  for (const arg of commandArgs) {
    if (arg.includes("/") || arg.includes("\\")) {
      const resolvedPath = path.resolve(WORKSPACE_ROOT, arg);

      const allowedPrefix = WORKSPACE_ROOT + path.sep;
      if (
        !resolvedPath.startsWith(allowedPrefix) &&
        resolvedPath !== WORKSPACE_ROOT
      ) {
        throw new Error(`アクセス拒否: ${arg}はワークスペース外です`);
      }
    }
  }

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let outputTruncated = false;

    const child = spawn(commandName, commandArgs, {
      cwd: WORKSPACE_ROOT,
      timeout: 3000,
      shell: false,
    });

    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stdout += chunk.slice(0, MAX_OUTPUT_LENGTH - stdout.length);
        outputTruncated = true;
      } else {
        stdout += chunk;
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();

      if (stderr.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stderr += chunk.slice(0, MAX_OUTPUT_LENGTH - stderr.length);
        outputTruncated = true;
      } else {
        stderr += chunk;
      }
    });

    child.on("close", (code: number | null) => {
      let result = "";

      if (stdout) {
        result += stdout;
      }

      if (stderr) {
        result += (result ? "\n" : "") + `stderrエラー: ${stderr}`;
      }
      if (outputTruncated) {
        result += "\n... (出力が長いため省略されました)";
      }

      // resolveはPromiseの成功を返すメソッド
      resolve(result || "(出力なし)");
    });

    // child onとは？
    // 子プロセスのエラーを監視するイベントハンドラー
    child.on("error", (error: Error) => {
      // rejectはPromiseのエラーを返すメソッド
      reject(new Error(`コマンド実行エラー: ${error.message}`));
    });
  });
}

export const execCommand = {
  name: "execCommand",
  description:
    "ワークスペース内で許可された汎用コマンドを実行する。利用可能なコマンドはbun, ls, git, ghです。",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "実行するコマンド(例: 'bun install', 'ls -la', 'git status', 'gh pr list')",
      },
    },
    required: ["command"],
  },
  execute: execCommandExecute,
};
