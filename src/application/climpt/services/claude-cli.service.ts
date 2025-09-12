/**
 * Claude CLI Service - External Analysis Service Implementation
 *
 * Implements the ExternalAnalysisService interface for Claude CLI integration.
 * Extracted from climpt-adapter.ts for better organization.
 */

import type { ExternalAnalysisService } from "../../../domain/core/abstractions.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";

/**
 * Claude CLI service adapter
 */
export class ClaudeCLIService implements ExternalAnalysisService {
  async analyze(
    prompt: string,
    _context?: Record<string, unknown>,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    // Create temporary file for the prompt
    let tempFile: string;
    try {
      tempFile = await Deno.makeTempFile({ suffix: ".txt" });
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "AIServiceError",
            service: "ClaudeCLI",
            statusCode: undefined,
          },
          `Failed to create temporary file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }

    try {
      await Deno.writeTextFile(tempFile, prompt);

      // Execute claude -p command
      const command = new Deno.Command("claude", {
        args: ["-p", tempFile],
        stdout: "piped",
        stderr: "piped",
      });

      const { stdout, stderr } = await command.output();

      if (stderr.length > 0) {
        const errorText = new TextDecoder().decode(stderr);
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "AIServiceError",
              service: "ClaudeCLI",
              statusCode: undefined,
            },
            `Claude CLI error: ${errorText}`,
          ),
        };
      }

      const output = new TextDecoder().decode(stdout);

      // Try to parse as JSON, fallback to raw text
      try {
        const parsed = JSON.parse(output);
        return { ok: true, data: parsed };
      } catch {
        return { ok: true, data: { raw: output } };
      }
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "AIServiceError",
            service: "ClaudeCLI",
            statusCode: undefined,
          },
          `Claude CLI execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    } finally {
      // Clean up temporary file
      try {
        await Deno.remove(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
