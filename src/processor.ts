import type { DomainError, ProcessingConfig, Result } from "./types.ts";
import { FrontmatterExtractor } from "./frontmatter-extractor.ts";
import { SchemaResolver } from "./schema-resolver.ts";
import { TemplateEngine } from "./core/template-engine.ts";
import { Aggregator } from "./aggregator.ts";

/**
 * Simplified canonical processor following Issue #591 requirements
 * Integrates Phase 2 totality-compliant services
 * FIXED: Now uses TemplateEngine instead of TemplateRenderer
 */
export class Processor {
  private constructor(
    private readonly extractor: FrontmatterExtractor,
    private readonly resolver: SchemaResolver,
    private readonly templateEngine: TemplateEngine,
    private readonly aggregator: Aggregator,
  ) {}

  static create(): Result<Processor, DomainError> {
    // Initialize all components using totality-compliant constructors
    const extractorResult = FrontmatterExtractor.create();
    if (!extractorResult.ok) return extractorResult;

    const resolverResult = SchemaResolver.create();
    if (!resolverResult.ok) return resolverResult;

    // Use TemplateEngine instead of TemplateRenderer
    const templateEngineResult = TemplateEngine.create();
    if (!templateEngineResult.ok) {
      return templateEngineResult;
    }
    const templateEngine = templateEngineResult.data;

    const aggregatorResult = Aggregator.create();
    if (!aggregatorResult.ok) return aggregatorResult;

    return {
      ok: true,
      data: new Processor(
        extractorResult.data,
        resolverResult.data,
        templateEngine,
        aggregatorResult.data,
      ),
    };
  }

  /**
   * Single canonical processing method - NO ALTERNATIVES
   * FIXED: Now uses TemplateEngine.process() instead of TemplateRenderer.render()
   */
  async process(
    config: ProcessingConfig,
  ): Promise<Result<string, DomainError>> {
    // Step 1: Resolve schema
    const schemaResult = await this.resolver.resolveSchema(config.schema);
    if (!schemaResult.ok) return schemaResult;

    // Step 2: Discover files using Phase 2 FilePatternMatcher
    const filesResult = await this.discoverFiles(config.input);
    if (!filesResult.ok) return filesResult;

    // Step 3: Extract frontmatter from all files
    const extractionResults = await Promise.all(
      filesResult.data.map((file) => this.extractor.extract(file)),
    );

    // Step 4: Validate against schema
    const validationResults = extractionResults.map((result) => {
      if (!result.ok) return result;
      return this.resolver.validate(schemaResult.data, result.data);
    });

    // Step 5: Aggregate validated data
    const aggregationResult = this.aggregator.aggregate(validationResults);
    if (!aggregationResult.ok) return aggregationResult;

    // Step 6: Load template content
    let templateContent: string;
    try {
      templateContent = await Deno.readTextFile(config.template.path);
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ReadError",
          path: config.template.path,
          details: String(error),
        },
      };
    }

    // Step 7: Use TemplateEngine.process() instead of TemplateRenderer.render()
    // Extract individual document data from aggregated result for template processing
    const documentData = this.extractDocumentData(
      aggregationResult.data.aggregatedData,
    );
    const output = this.templateEngine.process({
      schemaData: schemaResult.data.definition as Record<string, unknown>,
      documentData,
      templateContent,
    });

    return { ok: true, data: output };
  }

  private async discoverFiles(
    input: ProcessingConfig["input"],
  ): Promise<Result<string[], DomainError>> {
    // Simplified file discovery using glob pattern matching
    const files: string[] = [];
    const baseDir = input.baseDirectory || ".";

    try {
      for await (const entry of Deno.readDir(baseDir)) {
        if (entry.isFile && this.matchesPattern(entry.name, input.pattern)) {
          files.push(`${baseDir}/${entry.name}`);
        }
      }
      return { ok: true, data: files };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "ReadError", path: baseDir, details: String(error) },
      };
    }
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    // Simple glob pattern matching for common cases
    if (pattern === "*") return true;
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return filename.startsWith(prefix);
    }
    if (pattern.startsWith("*")) {
      const suffix = pattern.slice(1);
      return filename.endsWith(suffix);
    }
    if (pattern.includes("*")) {
      const parts = pattern.split("*");
      return parts.every((part, index) => {
        if (index === 0) return filename.startsWith(part);
        if (index === parts.length - 1) return filename.endsWith(part);
        return filename.includes(part);
      });
    }
    return filename === pattern;
  }

  private extractDocumentData(
    aggregatedData: Record<string, unknown>,
  ): Record<string, unknown>[] {
    // Extract individual file data from the aggregated result
    // The aggregator stores files in the 'files' property as an array
    const files = aggregatedData.files;
    if (Array.isArray(files)) {
      return files.map((file) => {
        if (typeof file === "object" && file !== null && "data" in file) {
          return (file as { data: Record<string, unknown> }).data;
        }
        return file as Record<string, unknown>;
      });
    }
    // Fallback: return single document wrapped in array
    return [aggregatedData];
  }
}
