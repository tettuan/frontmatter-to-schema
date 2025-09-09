// FrontMatter domain entities following DDD principles

import type { FrontMatterContent } from "../../../domain/models/value-objects.ts";

// Discriminated union for document frontmatter state following totality principle
export type DocumentFrontMatterState =
  | { kind: "WithFrontMatter"; frontMatter: FrontMatter }
  | { kind: "NoFrontMatter" };

// Discriminated union for frontmatter input during creation
export type FrontMatterInput = {
  kind: "Present";
  frontMatter: FrontMatter;
} | {
  kind: "NotPresent";
};

// Discriminated union for path resolution results
export type PathResolutionResult = {
  kind: "Found";
  value: unknown;
} | {
  kind: "NotFound";
  path: string;
};

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
