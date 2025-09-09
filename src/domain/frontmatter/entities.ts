/**
 * FrontMatter domain entities following DDD principles
 * Part of FrontMatter Management bounded context
 */

import type { FrontMatterContent } from "../models/value-objects.ts";

// Discriminated union for path resolution results
export type PathResolutionResult = {
  kind: "Found";
  value: unknown;
} | {
  kind: "NotFound";
  path: string;
};

/**
 * FrontMatter aggregate root
 * Represents parsed frontmatter content with raw text
 */
export class FrontMatter {
  constructor(
    private readonly content: FrontMatterContent,
    private readonly raw: string,
  ) {}

  static create(
    content: FrontMatterContent,
    raw: string,
  ): FrontMatter {
    return new FrontMatter(content, raw);
  }

  getContent(): FrontMatterContent {
    return this.content;
  }

  getRaw(): string {
    return this.raw;
  }

  toObject(): unknown {
    return this.content.toJSON();
  }

  /**
   * Resolve path in frontmatter content using totality-compliant pattern
   */
  resolvePath(path: string): PathResolutionResult {
    try {
      const content = this.content.toJSON();
      const pathParts = path.split(".");
      let current = content;

      for (const part of pathParts) {
        if (
          typeof current === "object" && current !== null && part in current
        ) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return { kind: "NotFound", path };
        }
      }

      return { kind: "Found", value: current };
    } catch {
      return { kind: "NotFound", path };
    }
  }
}
