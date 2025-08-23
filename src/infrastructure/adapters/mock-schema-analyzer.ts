// Mock Schema Analyzer for testing purposes
import type { Result } from "../../domain/shared/types.ts";
import {
  createError,
  type ProcessingError,
} from "../../domain/shared/types.ts";
import {
  ExtractedData,
  type FrontMatter,
  type Schema,
} from "../../domain/models/entities.ts";
import type { SchemaAnalyzer } from "../../domain/services/interfaces.ts";

export class MockSchemaAnalyzer implements SchemaAnalyzer {
  constructor(
    private readonly config?: unknown,
    private readonly extractionPromptTemplate?: string,
    private readonly mappingPromptTemplate?: string,
  ) {}
  analyze(
    frontMatter: FrontMatter,
    _schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>> {
    try {
      // Parse frontmatter content
      const frontMatterData = frontMatter.getContent().toJSON() as Record<
        string,
        unknown
      >;

      // Create mock extracted data based on frontmatter
      const mockExtractedData = {
        title: frontMatterData?.title || "Test Title",
        description: frontMatterData?.description || "Test Description",
        ...(frontMatterData || {}),
        // Add some mock processing metadata
        _mock: true,
        _processedAt: new Date().toISOString(),
      };

      return Promise.resolve({
        ok: true,
        data: ExtractedData.create(mockExtractedData),
      });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "mock",
          reason: error instanceof Error
            ? error.message
            : "Mock analysis failed",
        }),
      });
    }
  }
}
