/**
 * Document domain entities following DDD principles
 * Part of Document Management bounded context
 */

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import type { DocumentContent, DocumentPath } from "../models/value-objects.ts";
import type { FrontMatter } from "../frontmatter/entities.ts";

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

/**
 * Document identifier value object with Smart Constructor pattern
 */
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

/**
 * Document aggregate root
 * Represents a document with its content and frontmatter state
 */
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

  getContent(): DocumentContent {
    return this.content;
  }

  hasFrontMatter(): boolean {
    return this.frontMatterState.kind === "WithFrontMatter";
  }
  // Totality-compliant method using exhaustive pattern matching
  getFrontMatter(): FrontMatter | null {
    switch (this.frontMatterState.kind) {
      case "WithFrontMatter":
        return this.frontMatterState.frontMatter;
      case "NoFrontMatter":
        return null;
    }
  }

  // Legacy method for backward compatibility with tests
  getFrontMatterResult(): Result<FrontMatter, DomainError> {
    switch (this.frontMatterState.kind) {
      case "WithFrontMatter":
        return { ok: true, data: this.frontMatterState.frontMatter };
      case "NoFrontMatter":
        return { ok: false, error: { kind: "NotFound" } as DomainError };
    }
  }

  equals(other: Document): boolean {
    return this.id.equals(other.id);
  }
}
