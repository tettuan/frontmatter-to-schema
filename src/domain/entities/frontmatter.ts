// FrontMatter Entity following DDD principles
// Core entity for managing document frontmatter content

import type { FrontMatterContent } from "../models/value-objects.ts";
import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * FrontMatter entity
 * Encapsulates frontmatter content and raw representation
 */
export class FrontMatter {
  private constructor(
    private readonly content: FrontMatterContent,
    private readonly raw: string,
  ) {}

  /**
   * Create FrontMatter with validation
   * Ensures content and raw are not empty
   */
  static create(
    content: FrontMatterContent,
    raw: string,
  ): Result<FrontMatter, DomainError> {
    if (!raw || raw.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }),
      };
    }
    return { ok: true, data: new FrontMatter(content, raw) };
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
   */
  getValue(key: string): unknown | undefined {
    const obj = this.content.toJSON();
    if (typeof obj === "object" && obj !== null && key in obj) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }
}
