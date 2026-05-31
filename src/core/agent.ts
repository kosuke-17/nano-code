import { generateText } from "./generate-text";
import { requestApproval } from "./approval";
import type {
  LanguageModel,
  Message,
  Tool,
} from "../tools/file-operation/type";

interface AgentConfig {
  name: string;
  instructions: string;
  model: LanguageModel;
  tools: Record<string, any>;
  maxSteps?: number;
  verbose?: boolean;
  approvalFunc?: (toolName: string, args: any) => Promise<boolean>;
}

async function executeTool(tool: Tool, args: any): Promise<string> {
  try {
    return await tool.execute(args);
  } catch (error) {
    return `エラー: ${(error as Error).message ?? "不明なエラー"}`;
  }
}

export class Agent {
  private name: string;
  private instructions: string;
  private model: LanguageModel;
  private tools: Tool[];
  private maxSteps: number;
  private verbose: boolean;
  private approvalFunc: (toolName: string, args: any) => Promise<boolean>;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.model = config.model;
    this.tools = Object.values(config.tools);
    this.maxSteps = config.maxSteps ?? 100;
    this.verbose = config.verbose ?? false;
    this.approvalFunc = config.approvalFunc ?? requestApproval;
  }

  async generate(userPrompt: string): Promise<{ text: string }> {
    const messages: Message[] = [
      { role: "system", content: this.instructions },
      { role: "user", content: userPrompt },
    ];

    let currentStep = 0;
    let finalText = "";
    let toolCallCount = 0;

    while (currentStep < this.maxSteps) {
      currentStep++;

      if (this.verbose) {
        console.log(`\n=== ステップ ${currentStep}/${this.maxSteps} ===`);
      }

      const response = await generateText({
        model: this.model,
        messages,
        tools: this.tools,
      });

      if (response.text) {
        finalText = response.text;
        if (this.verbose) {
          console.log(`生成されたテキスト: ${finalText}`);
        }
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: response.text,
          toolCalls: response.toolCalls,
        });

        for (const toolCall of response.toolCalls) {
          const tool = this.tools.find((t) => t.name === toolCall.name);

          if (!tool) {
            messages.push({
              role: "tool",
              toolCallId: toolCall.toolCallId,
              name: toolCall.name,
              content: `えらー: ツール${toolCall.name}が見つかりませんでした。`,
            });
            continue;
          }

          if (this.verbose) {
            console.log(
              `[ツール実行] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
            );
          }

          if (tool.needsApproval) {
            const approved = await this.approvalFunc(
              toolCall.name,
              toolCall.args,
            );
            if (!approved) {
              messages.push({
                role: "tool",
                toolCallId: toolCall.toolCallId,
                name: toolCall.name,
                content:
                  "ユーザーによってキャンセルされました。別の方法を検討してください",
              });
              continue;
            }
          }

          const result = await executeTool(tool, toolCall.args);
          toolCallCount++;

          if (this.verbose) {
            console.log(
              `[結果]: ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`,
            );
          }

          messages.push({
            role: "tool",
            toolCallId: toolCall.toolCallId,
            name: toolCall.name,
            content: result,
          });
        }

        continue;
      }

      messages.push({
        role: "assistant",
        content: response.text,
      });
      break;
    }

    if (currentStep >= this.maxSteps) {
      console.warn("警告: 最大ステップ数に達しました。");
    }

    if (toolCallCount === 0 && currentStep === 1) {
      console.warn("警告: ツールを使用せずに回答が生成されました。");
    }

    return { text: finalText };
  }
}
