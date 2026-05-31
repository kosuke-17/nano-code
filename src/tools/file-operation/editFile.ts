import * as fs from "fs/promises";
import * as path from "path";

// なぜ毎回resolveをするのか？
// それは、ワークスペースのルートディレクトリを取得するためです。
// ワークスペースのルートディレクトリは、ワークスペース内のファイルを操作するための基準点として使用されます。
// ワークスペースのルートディレクトリを取得するために、path.resolveを使用しています。
// path.resolveは、引数に指定されたパスを絶対パスに変換する関数です。
// 引数に指定されたパスが相対パスの場合は、現在のディレクトリを基準にして絶対パスに変換します。
// 引数に指定されたパスが絶対パスの場合は、そのパスをそのまま返します。
// 引数に指定されたパスがワークスペースのルートディレクトリの場合は、ワークスペースのルートディレクトリを返します。
const WORKSPACE_ROOT = path.resolve(process.cwd(), "./workspace");

async function editFileExecute(args: {
  path: string;
  oldText: string;
  newText: string;
}): Promise<string> {
  const absolutePath = path.resolve(WORKSPACE_ROOT, args.path);

  // ワークスペース内かチェック(ディレクトリトラバーサル対策)
  const allowedPrefix = WORKSPACE_ROOT + path.sep;
  if (
    !absolutePath.startsWith(allowedPrefix) &&
    absolutePath !== WORKSPACE_ROOT
  ) {
    throw new Error(`アクセス拒否: ${args.path}はワークスペース外です`);
  }

  // ファイル内容を読み込む
  const content = await fs.readFile(absolutePath, "utf-8");
  const matches = content.split(args.oldText).length - 1;
  if (matches === 0) {
    const preview =
      args.oldText.length > 50
        ? `${args.oldText.slice(0, 30)}...`
        : args.oldText;
    throw new Error(`指定されたテキストが見つかりません: ${preview}`);
  }
  if (matches > 1) {
    throw new Error(
      `指定されたテキストが複数回出現しています: ${args.oldText}、より具体的な範囲を指定してください`,
    );
  }

  const newContent = content.replace(args.oldText, args.newText);
  await fs.writeFile(absolutePath, newContent, "utf-8");

  return `ファイルを編集しました： ${args.oldText.slice(0, 30)}... → ${args.newText.slice(0, 30)}...`;
}

export const editFile = {
  name: "editFile",
  description:
    "ファイルの一部を編集する。oldTextで指定した箇所をnewTextに置き換える。oldTextが複数見つかる場合はエラーを返すため、一意に特定できる範囲を指定すること。ファイル全体を読み書きするよりトークン消費が少ない。",
  needsApproval: true,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "編集するファイルのパス",
      },
      oldText: {
        type: "string",
        description: "編集する箇所のテキスト",
      },
      newText: {
        type: "string",
        description: "置き換えるテキスト",
      },
    },
    required: ["path", "oldText", "newText"],
  },
  execute: editFileExecute,
};
