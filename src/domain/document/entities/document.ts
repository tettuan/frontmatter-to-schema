// Document domain entities following DDD principles

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import type {
  DocumentContent,
  DocumentPath,
} from "../../../domain/models/value-objects.ts";
import type {
  DocumentFrontMatterState,
  FrontMatter,
  FrontMatterInput,
} from "../../frontmatter/entities/frontmatter.ts";

export class DocumentId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<DocumentId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new DocumentId(value) };
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

  getContent(): DocumentContent {
    return this.content;
  }

  hasFrontMatter(): boolean {
    return this.frontMatterState.kind === "WithFrontMatter";
  }
}
