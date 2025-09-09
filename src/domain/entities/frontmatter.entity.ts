/**
 * FrontMatter domain entity
 * Extracted from entities-original.ts for better organization
 * Represents parsed frontmatter content with both structured and raw forms
 */

import type { FrontMatterContent } from "../models/value-objects.ts";

/**
 * FrontMatter entity representing parsed document metadata
 * Encapsulates both the structured content and raw string representation
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
}
