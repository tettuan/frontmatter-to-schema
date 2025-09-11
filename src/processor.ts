import type { DomainError, ProcessingConfig, Result } from "./types.ts";
import { FrontmatterExtractor } from "./frontmatter-extractor.ts";
import { SchemaResolver } from "./schema-resolver.ts";
import { TemplateRenderer } from "./template-renderer.ts";
import { Aggregator } from "./aggregator.ts";

/**
 * Simplified canonical processor following Issue #591 requirements
 * Integrates Phase 2 totality-compliant services
 */
export class Processor {
  private constructor(
    private readonly extractor: FrontmatterExtractor,
    private readonly resolver: SchemaResolver,
    private readonly renderer: TemplateRenderer,
    private readonly aggregator: Aggregator,
  ) {}

  static create(): Result<Processor, DomainError> {
    // Initialize all components using totality-compliant constructors
    const extractorResult = FrontmatterExtractor.create();
    if (!extractorResult.ok) return extractorResult;

    const resolverResult = SchemaResolver.create();
    if (!resolverResult.ok) return resolverResult;

    const rendererResult = TemplateRenderer.create();
    if (!rendererResult.ok) return rendererResult;

    const aggregatorResult = Aggregator.create();
    if (!aggregatorResult.ok) return aggregatorResult;

    return {
      ok: true,
      data: new Processor(
        extractorResult.data,
        resolverResult.data,
        rendererResult.data,
        aggregatorResult.data,
      ),
    };
  }

  /**
   * Single canonical processing method - NO ALTERNATIVES
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

    // Step 6: Render template with schema context
    return await this.renderer.render(config.template, {
      aggregatedData: aggregationResult.data.aggregatedData,
      schema: schemaResult.data.definition,
    });
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
}
