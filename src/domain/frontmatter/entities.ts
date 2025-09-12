/**
 * FrontMatter domain entities following DDD principles
 * Part of FrontMatter Management bounded context
 */

import type { FrontMatterContent } from "../models/value-objects.ts";
import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

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
   * Check if frontmatter has a specific key
   */
  hasKey(key: string): boolean {
    const obj = this.content.toJSON();
    return typeof obj === "object" && obj !== null && key in obj;
  }

  /**
   * Get value for a specific key
   * Returns Result to handle missing keys explicitly
   */
  getValue(key: string): Result<unknown, DomainError> {
    const obj = this.content.toJSON();
    if (typeof obj === "object" && obj !== null && key in obj) {
      return { ok: true, data: (obj as Record<string, unknown>)[key] };
    }
    return {
      ok: false,
      error: createDomainError({
        kind: "NotFound",
        resource: "frontmatter",
        key: key,
      }),
    };
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
