// Claude AI-based schema analyzer implementation

import {
  type AIError,
  createError,
  type ProcessingError,
  type Result,
} from "../../domain/shared/types.ts";
import {
  ExtractedData,
  type FrontMatter,
  type Schema,
} from "../../domain/models/entities.ts";
import type {
  AnalysisConfiguration,
  SchemaAnalyzer,
} from "../../domain/services/interfaces.ts";

export class ClaudeSchemaAnalyzer implements SchemaAnalyzer {
  constructor(
    private readonly config: AnalysisConfiguration,
    private readonly extractionPromptTemplate: string,
    private readonly mappingPromptTemplate: string,
  ) {}

  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>> {
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";

    try {
      // Prepare extraction prompt
      if (verboseMode) {
        console.log("🤖 [VERBOSE] Preparing frontmatter extraction prompt...");
      }
      const extractionPrompt = this.prepareExtractionPrompt(
        frontMatter.getRaw(),
        schema.getDefinition().getValue(),
      );

      if (verboseMode) {
        console.log(
          "📤 [VERBOSE] Calling Claude API for frontmatter extraction...",
        );
        console.log(
          "🎯 [DEBUG] Extraction prompt preview:",
          extractionPrompt.substring(0, 200) + "...",
        );
      }

      // Call Claude API for extraction
      const extractionResult = await this.callClaudeAPI(extractionPrompt);
      if (!extractionResult.ok) {
        if (verboseMode) {
          console.log(
            "❌ [VERBOSE] Claude API extraction failed:",
            extractionResult.error.message,
          );
        }
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: extractionResult.error.message,
          }),
        };
      }

      if (verboseMode) {
        console.log("✅ [VERBOSE] Claude API extraction successful");
        console.log("📋 [DEBUG] Raw extraction result from Claude -p:");
        console.log("─────────── EXTRACTION RESULT START ───────────");
        console.log(extractionResult.data);
        console.log("─────────── EXTRACTION RESULT END ───────────");
      }

      // Parse extraction result
      const extractedData = this.parseExtractionResult(extractionResult.data);
      if (!extractedData) {
        if (verboseMode) {
          console.log("❌ [VERBOSE] Failed to parse extraction result");
        }
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: "Failed to parse extraction result",
          }),
        };
      }

      if (verboseMode) {
        console.log("✅ [VERBOSE] Extraction result parsed successfully");
        console.log("📊 [DEBUG] Parsed frontmatter analysis result:");
        console.log(JSON.stringify(extractedData, null, 2));
      }

      // Prepare mapping prompt
      if (verboseMode) {
        console.log("🗺️ [VERBOSE] Preparing template mapping prompt...");
      }
      const mappingPrompt = this.prepareMappingPrompt(
        extractedData,
        schema.getDefinition().getValue(),
      );

      if (verboseMode) {
        console.log("📤 [VERBOSE] Calling Claude API for template mapping...");
        console.log(
          "🎯 [DEBUG] Mapping prompt preview:",
          mappingPrompt.substring(0, 200) + "...",
        );
      }

      // Call Claude API for mapping
      const mappingResult = await this.callClaudeAPI(mappingPrompt);
      if (!mappingResult.ok) {
        if (verboseMode) {
          console.log(
            "❌ [VERBOSE] Claude API mapping failed:",
            mappingResult.error.message,
          );
        }
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: mappingResult.error.message,
          }),
        };
      }

      if (verboseMode) {
        console.log("✅ [VERBOSE] Claude API mapping successful");
        console.log("📋 [DEBUG] Raw mapping result from Claude -p:");
        console.log("─────────── MAPPING RESULT START ───────────");
        console.log(mappingResult.data);
        console.log("─────────── MAPPING RESULT END ───────────");
      }

      // Parse mapping result
      const mappedData = this.parseMappingResult(mappingResult.data);
      if (!mappedData) {
        if (verboseMode) {
          console.log("❌ [VERBOSE] Failed to parse mapping result");
        }
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: "Failed to parse mapping result",
          }),
        };
      }

      if (verboseMode) {
        console.log("✅ [VERBOSE] Mapping result parsed successfully");
        console.log("📊 [DEBUG] Final template mapping result:");
        console.log(JSON.stringify(mappedData, null, 2));
      }

      return { ok: true, data: ExtractedData.create(mappedData) };
    } catch (error) {
      if (verboseMode) {
        console.log("❌ [VERBOSE] Unexpected error in Claude analysis:", error);
      }
      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "unknown",
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  private prepareExtractionPrompt(
    frontMatter: string,
    schema: unknown,
  ): string {
    return this.extractionPromptTemplate
      .replace("{{FRONTMATTER}}", frontMatter)
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2));
  }

  private prepareMappingPrompt(
    extractedData: unknown,
    schema: unknown,
  ): string {
    return this.mappingPromptTemplate
      .replace("{{EXTRACTED_DATA}}", JSON.stringify(extractedData, null, 2))
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2));
  }

  private async callClaudeAPI(
    prompt: string,
  ): Promise<Result<string, AIError & { message: string }>> {
    // Check prompt length
    if (prompt.length > 100000) {
      return {
        ok: false,
        error: createError({
          kind: "PromptTooLong",
          length: prompt.length,
          maxLength: 100000,
        }),
      };
    }

    let tempFile: string | null = null;
    try {
      // First check if claude command exists
      try {
        const checkCommand = new Deno.Command("which", {
          args: ["claude"],
          stdout: "piped",
          stderr: "piped",
        });
        const checkResult = await checkCommand.output();
        if (checkResult.code !== 0) {
          return {
            ok: false,
            error: createError({
              kind: "APIError",
              message:
                "Claude CLI not found. Please install the Claude CLI or set FRONTMATTER_TO_SCHEMA_TEST_MODE=true to use mock mode.",
            }),
          };
        }
      } catch {
        return {
          ok: false,
          error: createError({
            kind: "APIError",
            message:
              "Failed to check for Claude CLI. Please install the Claude CLI or set FRONTMATTER_TO_SCHEMA_TEST_MODE=true to use mock mode.",
          }),
        };
      }

      // Execute claude command with prompt
      tempFile = await Deno.makeTempFile({ suffix: ".md" });
      await Deno.writeTextFile(tempFile, prompt);

      // Get temperature setting for stable results (default to 0.1 for consistency)
      const temperature = Deno.env.get("FRONTMATTER_CLAUDE_TEMPERATURE") ||
        "0.1";
      const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";

      if (verboseMode) {
        console.log(
          `🌡️ [VERBOSE] Using Claude temperature: ${temperature} (lower = more stable)`,
        );
      }

      const command = new Deno.Command("claude", {
        args: ["-p", tempFile, "--temperature", temperature],
        stdout: "piped",
        stderr: "piped",
      });

      // Create a timeout promise (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Claude API call timed out after 30 seconds")),
          30000,
        );
      });

      // Race between command execution and timeout
      const outputPromise = command.output();
      let result;
      try {
        result = await Promise.race([outputPromise, timeoutPromise]);
      } catch (timeoutError) {
        // Try to kill the process if it's still running
        try {
          const ps = new Deno.Command("pkill", {
            args: ["-f", `claude.*${tempFile}`],
          });
          await ps.output();
        } catch {
          // Ignore cleanup errors
        }
        throw timeoutError;
      }

      const { code, stdout, stderr } = result as Awaited<
        ReturnType<typeof command.output>
      >;

      // Clean up temp file
      if (tempFile) {
        try {
          await Deno.remove(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }

      if (code !== 0) {
        const errorMsg = new TextDecoder().decode(stderr);
        return {
          ok: false,
          error: createError({
            kind: "APIError",
            message: errorMsg || "Claude command failed",
            code: code.toString(),
          }),
        };
      }

      const response = new TextDecoder().decode(stdout);
      return { ok: true, data: response };
    } catch (error) {
      // Clean up temp file on error
      if (tempFile) {
        try {
          await Deno.remove(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }

      return {
        ok: false,
        error: createError({
          kind: "APIError",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  private parseExtractionResult(
    response: string,
  ): Record<string, unknown> | null {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try direct JSON parse
      return JSON.parse(response);
    } catch {
      // Try to extract key-value pairs
      const result: Record<string, unknown> = {};
      const lines = response.split("\n");

      for (const line of lines) {
        const match = line.match(/^(.+?):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          result[key.trim()] = this.parseValue(value.trim());
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    }
  }

  private parseMappingResult(response: string): Record<string, unknown> | null {
    return this.parseExtractionResult(response);
  }

  private parseValue(value: string): unknown {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Check for boolean
      if (value === "true") return true;
      if (value === "false") return false;

      // Check for number
      const num = Number(value);
      if (!isNaN(num)) return num;

      // Return as string
      return value;
    }
  }
}
