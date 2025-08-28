import { parse } from "jsr:@std/yaml@1";
import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

export class FrontMatter {
  constructor(
    public readonly raw: string,
    public readonly data: Record<string, unknown>,
  ) {}

  get(key: string): unknown {
    return this.data[key];
  }

  has(key: string): boolean {
    return key in this.data;
  }

  toJson(): string {
    return JSON.stringify(this.data, null, 2);
  }
}

export class FrontMatterExtractor {
  private readonly frontMatterRegex = /^---\n([\s\S]*?)---/;

  extract(content: string): FrontMatter | null {
    const match = content.match(this.frontMatterRegex);

    if (!match || match[1] === undefined) {
      return null;
    }

    const raw = match[1];

    // Handle empty frontmatter
    if (raw.trim() === "") {
      return new FrontMatter(raw, {});
    }

    try {
      const yamlResult = parse(raw);
      const data = this.validateRecordObject(yamlResult) ? yamlResult : {};
      return new FrontMatter(raw, data);
    } catch (_error) {
      // Return null for invalid YAML
      return null;
    }
  }

  /**
   * Extract frontmatter with totality principle (returns Result type)
   * New method that follows totality principles while maintaining backward compatibility
   */
  extractSafe(content: string): Result<FrontMatter, DomainError & { message: string }> {
    const match = content.match(this.frontMatterRegex);

    if (!match || match[1] === undefined) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "frontmatter",
        }, "No frontmatter found in content"),
      };
    }

    const raw = match[1];

    // Handle empty frontmatter
    if (raw.trim() === "") {
      return {
        ok: true,
        data: new FrontMatter(raw, {}),
      };
    }

    try {
      const yamlResult = parse(raw);
      const data = this.validateRecordObject(yamlResult) ? yamlResult : {};
      return {
        ok: true,
        data: new FrontMatter(raw, data),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: raw,
          details: error instanceof Error ? error.message : "Unknown YAML parse error",
        }, "Failed to parse YAML frontmatter"),
      };
    }
  }

  hasFrontMatter(content: string): boolean {
    return this.frontMatterRegex.test(content);
  }

  /**
   * Type guard to validate that a value is a Record<string, unknown>
   */
  private validateRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
