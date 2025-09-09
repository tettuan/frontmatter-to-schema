/**
 * Domain identifier value objects with Smart Constructors
 * Extracted from entities-original.ts for better organization
 * Follows Totality principles and DDD identifier patterns
 */

import type { DomainError, Result } from "../core/result.ts";
import type { DocumentPath } from "../models/value-objects.ts";

/**
 * Document identifier value object
 * Uniquely identifies a document in the system
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
 * Schema identifier value object
 * Uniquely identifies a schema in the system
 */
export class SchemaId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<SchemaId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new SchemaId(value) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SchemaId): boolean {
    return this.value === other.value;
  }
}

/**
 * Template identifier value object
 * Uniquely identifies a template in the system
 */
export class TemplateId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<TemplateId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new TemplateId(value) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TemplateId): boolean {
    return this.value === other.value;
  }
}

/**
 * Analysis identifier value object
 * Uniquely identifies an analysis operation in the system
 */
export class AnalysisId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<AnalysisId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new AnalysisId(value) };
  }

  static generate(): AnalysisId {
    return new AnalysisId(crypto.randomUUID());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: AnalysisId): boolean {
    return this.value === other.value;
  }
}
