/**
 * Base domain error class following the Totality principle.
 * All domain-specific errors should extend this class.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * Schema-related errors.
 * Used for schema loading, validation, and processing failures.
 */
export class SchemaError extends DomainError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
  }
}

/**
 * Frontmatter-related errors.
 * Used for frontmatter extraction, parsing, and validation failures.
 */
export class FrontmatterError extends DomainError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
  }
}

/**
 * Template-related errors.
 * Used for template loading, parsing, and rendering failures.
 */
export class TemplateError extends DomainError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
  }
}

/**
 * File system related errors.
 * Used for file reading, writing, and path resolution failures.
 */
export class FileSystemError extends DomainError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
  }
}

/**
 * Pipeline orchestration errors.
 * Used for high-level processing coordination failures.
 */
export class PipelineError extends DomainError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
  }
}