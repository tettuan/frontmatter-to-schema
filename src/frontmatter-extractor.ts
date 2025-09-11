import type { DomainError, Result } from "./types.ts";
import { DEFAULT_DEBUG_OUTPUT_LIMIT } from "./domain/shared/constants.ts";

export interface ExtractedData {
  readonly path: string;
  readonly data: Record<string, unknown>;
}

export class FrontmatterExtractor {
  private constructor() {}

  static create(): Result<FrontmatterExtractor, DomainError> {
    return { ok: true, data: new FrontmatterExtractor() };
  }

  async extract(filePath: string): Promise<Result<ExtractedData, DomainError>> {
    try {
      const content = await Deno.readTextFile(filePath);

      // Extract frontmatter using simple regex (following totality)
      const frontmatterMatch = content.match(/^---\n(.*?)\n---/s);
      if (!frontmatterMatch) {
        return {
          ok: false,
          error: {
            kind: "FrontmatterExtractionFailed",
            content: content.slice(0, DEFAULT_DEBUG_OUTPUT_LIMIT.getValue()),
          },
        };
      }

      // Parse YAML frontmatter
      const yamlContent = frontmatterMatch[1];
      const data = this.parseYaml(yamlContent);

      return {
        ok: true,
        data: { path: filePath, data },
      };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "ReadError", path: filePath, details: String(error) },
      };
    }
  }

  private parseYaml(content: string): Record<string, unknown> {
    // Simplified YAML parsing for common frontmatter patterns
    const result: Record<string, unknown> = {};
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      result[key] = this.parseValue(value);
    }

    return result;
  }

  private parseValue(value: string): unknown {
    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // Parse numbers
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    // Parse booleans
    if (value === "true") return true;
    if (value === "false") return false;

    return value;
  }
}
