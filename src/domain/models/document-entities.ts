// Document-related entities following DDD principles

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import type {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
} from "./value-objects.ts";

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

// DocumentId value object
export class DocumentId {
  private constructor(private readonly value: string) {
    Object.freeze(this);
  }

  static create(
    value: string,
  ): Result<DocumentId, DomainError & { message: string }> {
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "DocumentId cannot be empty",
        } as DomainError & { message: string },
      };
    }
    return { ok: true, data: new DocumentId(value.trim()) };
  }

  static fromPath(path: DocumentPath): DocumentId {
    return new DocumentId(path.getValue());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: DocumentId): boolean {
    return this.value === other.value;
  }
}

// Document entity
export class Document {
  constructor(
    private readonly id: DocumentId,
    private readonly path: DocumentPath,
    private readonly frontMatterState: DocumentFrontMatterState,
    private readonly content: DocumentContent,
  ) {}

  static create(
    path: DocumentPath,
    frontMatterState: DocumentFrontMatterState,
    content: DocumentContent,
  ): Document {
    return new Document(
      DocumentId.fromPath(path),
      path,
      frontMatterState,
      content,
    );
  }

  // Totality-compliant method using discriminated union input
  static createWithFrontMatterInput(
    path: DocumentPath,
    frontMatterInput: FrontMatterInput,
    content: DocumentContent,
  ): Document {
    const frontMatterState: DocumentFrontMatterState =
      frontMatterInput.kind === "Present"
        ? { kind: "WithFrontMatter", frontMatter: frontMatterInput.frontMatter }
        : { kind: "NoFrontMatter" };
    return new Document(
      DocumentId.fromPath(path),
      path,
      frontMatterState,
      content,
    );
  }

  // Convenience method for backward compatibility during migration
  // @deprecated Use createWithFrontMatterInput for Totality compliance
  static createWithFrontMatter(
    path: DocumentPath,
    frontMatter: FrontMatter | null,
    content: DocumentContent,
  ): Document {
    const frontMatterInput: FrontMatterInput = frontMatter
      ? { kind: "Present", frontMatter }
      : { kind: "NotPresent" };
    return Document.createWithFrontMatterInput(path, frontMatterInput, content);
  }

  getId(): DocumentId {
    return this.id;
  }

  getPath(): DocumentPath {
    return this.path;
  }

  getContent(): DocumentContent {
    return this.content;
  }

  getFrontMatterState(): DocumentFrontMatterState {
    return this.frontMatterState;
  }

  /**
   * Get front matter as a Result type following totality principle
   * This method eliminates null returns and provides explicit error handling
   */
  getFrontMatterResult(): Result<FrontMatter, DomainError> {
    switch (this.frontMatterState.kind) {
      case "WithFrontMatter":
        return { ok: true, data: this.frontMatterState.frontMatter };
      case "NoFrontMatter":
        return {
          ok: false,
          error: {
            kind: "NoFrontMatterPresent",
          } as DomainError,
        };
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = this.frontMatterState;
        return {
          ok: false,
          error: {
            kind: "InvalidState",
            expected: "WithFrontMatter or NoFrontMatter",
            actual: String(_exhaustiveCheck),
          } as DomainError,
        };
      }
    }
  }

  hasFrontMatter(): boolean {
    return this.frontMatterState.kind === "WithFrontMatter";
  }
}

// FrontMatter entity
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

  getData(): FrontMatterContent {
    return this.content;
  }

  getValue(key: string): unknown {
    const data = this.content.toJSON();
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)[key]
      : undefined;
  }

  hasProperty(key: string): boolean {
    const data = this.content.toJSON();
    return data && typeof data === "object" && !Array.isArray(data)
      ? key in (data as Record<string, unknown>)
      : false;
  }

  getKeys(): string[] {
    const data = this.content.toJSON();
    return data && typeof data === "object" && !Array.isArray(data)
      ? Object.keys(data as Record<string, unknown>)
      : [];
  }
}
