import type { Result } from "../../domain/core/result.ts";
import { type APIError, createAPIError } from "../../domain/shared/errors.ts";
import type {
  AIAnalysisRequest,
  AIAnalysisResponse,
  AIAnalyzerPort,
} from "../ports/index.ts";

export class ClaudeAnalyzerAdapter implements AIAnalyzerPort {
  async analyze(
    request: AIAnalysisRequest,
  ): Promise<Result<AIAnalysisResponse, APIError>> {
    try {
      // Build command arguments
      const args = ["claude", "-p"];

      if (request.systemPrompt) {
        args.push("-s", request.systemPrompt);
      }

      if (request.temperature !== undefined) {
        args.push("-t", request.temperature.toString());
      }

      if (request.maxTokens) {
        args.push("-m", request.maxTokens.toString());
      }

      // Create the command
      const command = new Deno.Command("bash", {
        args: [
          "-c",
          `echo '${this.escapeContent(request.content)}' | ${args.join(" ")} '${
            this.escapeContent(request.prompt)
          }'`,
        ],
        stdout: "piped",
        stderr: "piped",
      });

      // Execute the command
      const { code, stdout, stderr } = await command.output();

      if (code !== 0) {
        const errorMessage = new TextDecoder().decode(stderr);
        return {
          ok: false,
          error: createAPIError(
            `Claude analysis failed: ${errorMessage}`,
            code,
          ),
        };
      }

      const result = new TextDecoder().decode(stdout);

      return {
        ok: true,
        data: {
          result: result.trim(),
          // Usage information would need to be parsed from Claude's output
          // if available
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createAPIError(
          `Failed to execute Claude: ${error}`,
        ),
      };
    }
  }

  private escapeContent(content: string): string {
    // Escape single quotes for shell
    return content.replace(/'/g, "'\\''");
  }
}
