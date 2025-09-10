/**
 * Claude CLI Service - External Analysis Service Implementation
 *
 * Implements the ExternalAnalysisService interface for Claude CLI integration.
 * Extracted from climpt-adapter.ts for better organization.
 */

import type { ExternalAnalysisService } from "../../../domain/core/abstractions.ts";

/**
 * Claude CLI service adapter
 */
export class ClaudeCLIService implements ExternalAnalysisService {
  async analyze(
    prompt: string,
    _context?: Record<string, unknown>,
  ): Promise<unknown> {
    // Create temporary file for the prompt
    const tempFile = await Deno.makeTempFile({ suffix: ".txt" });

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
        throw new Error(`Claude CLI error: ${errorText}`);
      }

      const output = new TextDecoder().decode(stdout);

      // Try to parse as JSON, fallback to raw text
      try {
        return JSON.parse(output);
      } catch {
        return { raw: output };
      }
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
