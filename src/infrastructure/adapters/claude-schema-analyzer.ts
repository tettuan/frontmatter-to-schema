// Claude AI-based schema analyzer implementation

import {
  Result,
  ProcessingError,
  AIError,
  createError,
} from "../../domain/shared/types.ts";
import {
  FrontMatter,
  Schema,
  ExtractedData,
} from "../../domain/models/entities.ts";
import {
  SchemaAnalyzer,
  AnalysisConfiguration,
} from "../../domain/services/interfaces.ts";

export class ClaudeSchemaAnalyzer implements SchemaAnalyzer {
  constructor(
    private readonly config: AnalysisConfiguration,
    private readonly extractionPromptTemplate: string,
    private readonly mappingPromptTemplate: string
  ) {}

  async analyze(
    frontMatter: FrontMatter,
    schema: Schema
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>> {
    try {
      // Prepare extraction prompt
      const extractionPrompt = this.prepareExtractionPrompt(
        frontMatter.getRaw(),
        schema.getDefinition().getValue()
      );

      // Call Claude API for extraction
      const extractionResult = await this.callClaudeAPI(extractionPrompt);
      if (!extractionResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: extractionResult.error.message
          })
        };
      }

      // Parse extraction result
      const extractedData = this.parseExtractionResult(extractionResult.data);
      if (!extractedData) {
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: "Failed to parse extraction result"
          })
        };
      }

      // Prepare mapping prompt
      const mappingPrompt = this.prepareMappingPrompt(
        extractedData,
        schema.getDefinition().getValue()
      );

      // Call Claude API for mapping
      const mappingResult = await this.callClaudeAPI(mappingPrompt);
      if (!mappingResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: mappingResult.error.message
          })
        };
      }

      // Parse mapping result
      const mappedData = this.parseMappingResult(mappingResult.data);
      if (!mappedData) {
        return {
          ok: false,
          error: createError({
            kind: "AnalysisFailed",
            document: "unknown",
            reason: "Failed to parse mapping result"
          })
        };
      }

      return { ok: true, data: ExtractedData.create(mappedData) };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "unknown",
          reason: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }

  private prepareExtractionPrompt(frontMatter: string, schema: unknown): string {
    return this.extractionPromptTemplate
      .replace("{{FRONTMATTER}}", frontMatter)
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2));
  }

  private prepareMappingPrompt(extractedData: unknown, schema: unknown): string {
    return this.mappingPromptTemplate
      .replace("{{EXTRACTED_DATA}}", JSON.stringify(extractedData, null, 2))
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2));
  }

  private async callClaudeAPI(prompt: string): Promise<Result<string, AIError & { message: string }>> {
    // Check prompt length
    if (prompt.length > 100000) {
      return {
        ok: false,
        error: createError({
          kind: "PromptTooLong",
          length: prompt.length,
          maxLength: 100000
        })
      };
    }

    try {
      // Execute claude command with prompt
      const tempFile = await Deno.makeTempFile({ suffix: ".md" });
      await Deno.writeTextFile(tempFile, prompt);

      const command = new Deno.Command("claude", {
        args: ["-p", tempFile],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await command.output();
      
      // Clean up temp file
      await Deno.remove(tempFile);

      if (code !== 0) {
        const errorMsg = new TextDecoder().decode(stderr);
        return {
          ok: false,
          error: createError({
            kind: "APIError",
            message: errorMsg || "Claude command failed",
            code: code.toString()
          })
        };
      }

      const response = new TextDecoder().decode(stdout);
      return { ok: true, data: response };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "APIError",
          message: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }

  private parseExtractionResult(response: string): Record<string, unknown> | null {
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