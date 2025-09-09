/**
 * Document domain entity
 * Extracted from entities-original.ts for better organization
 * Represents a document with its path, content, and optional frontmatter
 * Follows Totality principles with discriminated unions and Result types
 */

import type { DomainError, Result } from "../core/result.ts";
import type { DocumentContent, DocumentPath } from "../models/value-objects.ts";
import type {
  DocumentFrontMatterState,
  FrontMatterInput,
} from "../types/domain-types.ts";
import { DocumentId } from "../value-objects/identifier-value-objects.ts";
import type { FrontMatter } from "./frontmatter.entity.ts";

/**
 * Document entity representing a processed document
 * Encapsulates document identity, path, content, and frontmatter state
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
