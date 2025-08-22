// Mock schema analyzer for testing purposes

import { parse } from "jsr:@std/yaml@1.0.5/parse";
import {
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

export class MockSchemaAnalyzer implements SchemaAnalyzer {
  constructor(
    private readonly config: AnalysisConfiguration,
    private readonly extractionPromptTemplate: string,
    private readonly mappingPromptTemplate: string,
  ) {}

  async analyze(
    frontMatter: FrontMatter,
    _schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>> {
    try {
      // Use the raw YAML content instead of the JSON-encoded content
      const rawYamlContent = frontMatter.getRaw();

      // Minimal async operation to satisfy linter
      await Promise.resolve();

      const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";
      
      if (verboseMode || Deno.env.get("FRONTMATTER_DEBUG")) {
        console.log("🔍 [DEBUG] Mock analyzer - rawYamlContent:", rawYamlContent);
      }

      const parsedData = parse(rawYamlContent) as Record<string, unknown>;

      // For testing, just return the frontmatter data as-is
      // In a real mock, you might transform it to match the schema
      const mockResult = {
        ...parsedData,
        // Add any missing required fields with default values
        _mock: true,
      };

      if (verboseMode || Deno.env.get("FRONTMATTER_DEBUG")) {
        console.log("🔍 [DEBUG] Mock analyzer - mockResult:", mockResult);
        console.log("🔍 [DEBUG] Creating ExtractedData from mockResult...");
      }

      const extractedData = ExtractedData.create(mockResult);
      
      if (verboseMode || Deno.env.get("FRONTMATTER_DEBUG")) {
        console.log("🔍 [DEBUG] ExtractedData created successfully");
        console.log("🔍 [DEBUG] Returning success result");
      }

      return { ok: true, data: extractedData };
    } catch (error) {
      const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";
      if (verboseMode || Deno.env.get("FRONTMATTER_DEBUG")) {
        console.log("❌ [DEBUG] Mock analyzer error:", error);
        console.log("❌ [DEBUG] Error stack:", error instanceof Error ? error.stack : "no stack");
      }
      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "unknown",
          reason: error instanceof Error
            ? error.message
            : "Mock analysis failed",
        }),
      };
    }
  }
}
