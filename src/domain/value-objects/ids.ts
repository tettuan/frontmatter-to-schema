// ID Value Objects following DDD and Totality principles
// All IDs use Smart Constructor pattern with Result type

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { DocumentPath } from "../models/value-objects.ts";

/**
 * Document identifier value object
 * Ensures non-empty, trimmed string values
 */
export class DocumentId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<DocumentId, DomainError & { message: string }> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput" }),
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

  toString(): string {
    return this.value;
  }
}

/**
 * Schema identifier value object
 * Ensures non-empty, trimmed string values
 */
export class SchemaId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<SchemaId, DomainError & { message: string }> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput" }),
      };
    }
    return { ok: true, data: new SchemaId(value.trim()) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SchemaId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Template identifier value object
 * Ensures non-empty, trimmed string values
 */
export class TemplateId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<TemplateId, DomainError & { message: string }> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput" }),
      };
    }
    return { ok: true, data: new TemplateId(value.trim()) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TemplateId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Analysis identifier value object
 * Supports both manual creation and UUID generation
 */
export class AnalysisId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<AnalysisId, DomainError & { message: string }> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput" }),
      };
    }
    return { ok: true, data: new AnalysisId(value.trim()) };
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

  toString(): string {
    return this.value;
  }
}
