// Document Entity following DDD and Totality principles
// Core aggregate root for document processing

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import type { DocumentContent, DocumentPath } from "../models/value-objects.ts";
import type { DocumentId } from "../value-objects/ids.ts";
import { DocumentId as DocumentIdImpl } from "../value-objects/ids.ts";
import type { FrontMatter } from "./frontmatter.ts";
import type {
  DocumentFrontMatterState,
  FrontMatterInput,
} from "../value-objects/states.ts";

/**
 * Document entity - Aggregate root
 * Manages document lifecycle with frontmatter and content
 */
export class Document {
  private constructor(
    private readonly id: DocumentId,
    private readonly path: DocumentPath,
    private readonly frontMatterState: DocumentFrontMatterState,
    private readonly content: DocumentContent,
  ) {}

  /**
   * Create document with explicit frontmatter state
   * Follows Totality principle with discriminated union
   */
  static create(
    path: DocumentPath,
    frontMatterState: DocumentFrontMatterState,
    content: DocumentContent,
  ): Document {
    return new Document(
      DocumentIdImpl.fromPath(path),
      path,
      frontMatterState,
      content,
    );
  }

  /**
   * Create document with frontmatter input
   * Converts input to internal state representation
   */
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
      DocumentIdImpl.fromPath(path),
      path,
      frontMatterState,
      content,
    );
  }

  /**
   * @deprecated Use createWithFrontMatterInput for Totality compliance
   * Kept for backward compatibility during migration
   */
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
   * Get frontmatter with Result type
   * Eliminates null returns for explicit error handling
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
    }
  }

  getContent(): DocumentContent {
    return this.content;
  }

  hasFrontMatter(): boolean {
    return this.frontMatterState.kind === "WithFrontMatter";
  }

  /**
   * Get document filename from path
   */
  getFileName(): string {
    const pathStr = this.path.getValue();
    const lastSlash = pathStr.lastIndexOf("/");
    return lastSlash === -1 ? pathStr : pathStr.substring(lastSlash + 1);
  }

  /**
   * Check if document matches a pattern
   */
  matchesPattern(pattern: RegExp): boolean {
    return pattern.test(this.path.getValue());
  }
}
