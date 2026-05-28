import * as fs from "fs/promises";
import * as path from "path";

// ワークスペースのルートディレクトリ
const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace");

// 読み込み可能なファイルサイズの上限(LLM コンテキスト保護)
const MAX_FILE_SIZE = 100 * 1024;

async function readFileExecute(args: { path: string }): Promise<string> {
  // 相対パスを絶対パスに変換
  const absolutePath = path.resolve(WORKSPACE_ROOT, args.path);

  // ワークスペースないかチェック
  const allowedPrefix = WORKSPACE_ROOT + path.sep;

  if (
    !absolutePath.startsWith(allowedPrefix) &&
    absolutePath !== WORKSPACE_ROOT
  ) {
    throw new Error(`アクセス拒否: ${args.path}はワークスペース外です`);
  }

  // シンボリックリンクを解決して実パスを検証
  const realPath = await fs.realpath(absolutePath);
  if (!realPath.startsWith(allowedPrefix) && realPath !== WORKSPACE_ROOT) {
    throw new Error(
      `アクセス拒否: ${args.path}はシンボリック経由でワークスペース外を参照しています`,
    );
  }

  // ファイル種別とサイズチェック
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      throw new Error(`通常ファイルではありません: ${args.path}`);
    }
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(
        "ファイルが大きすぎます。100kb以下のファイルを読み込めます",
      );
    }
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error(`ファイルが見つかりません: ${args.path}`);
    }
  }

  // ファイル読みおみ
  const content = await fs.readFile(absolutePath, "utf-8");
  return content;
}

export const readFile = {
  name: "readFile",
  // LLMが判断をしやすい内容を心がける。
  description:
    "ワークスペース内の指定されたパスのファイル内容を文字列として読み込む。ファイルが存在しない場合はエラーを返す。100kbを超える巨大なファイルは読み込めない。相対パスまたは絶対パスを指定できる。",
  needsApproval: false,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "読み込むファイルのパス(例: 'README.md', 'src/index.ts')",
      },
    },
    required: ["path"],
  },
  execute: readFileExecute,
};
