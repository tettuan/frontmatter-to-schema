/**
 * Template Domain Value Objects
 *
 * These value objects are shared between Template Building and Template Output domains.
 * They ensure type safety and business rule enforcement at the domain level.
 */

/**
 * Represents a path to a template file obtained from Schema
 */
export class TemplateFilePath {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
    this.validate();
  }

  private validate(): void {
    if (!this.path || this.path.trim() === '') {
      throw new Error('Template path cannot be empty');
    }

    if (this.path.includes('..')) {
      throw new Error('Template path cannot contain directory traversal');
    }
  }

  toString(): string {
    return this.path;
  }

  resolve(basePath?: string): string {
    if (this.path.startsWith('/')) {
      return this.path;
    }

    if (basePath) {
      return `${basePath}/${this.path}`.replace(/\/+/g, '/');
    }

    return this.path;
  }

  equals(other: TemplateFilePath): boolean {
    return this.path === other.path;
  }
}

/**
 * Represents a set of values to be applied to a template
 */
export interface TemplateValueSet {
  values: Record<string, unknown>;
  metadata?: {
    source: string;
    timestamp: Date;
    schemaVersion?: string;
  };
}

/**
 * Source data for template building
 */
export interface TemplateSource {
  templatePath: TemplateFilePath;
  valueSet: TemplateValueSet;
}

/**
 * Output format enumeration
 */
export enum OutputFormat {
  JSON = 'json',
  YAML = 'yaml',
  XML = 'xml',
  MARKDOWN = 'markdown',
  HTML = 'html',
  TEXT = 'text'
}

/**
 * Output encoding enumeration
 */
export enum OutputEncoding {
  UTF8 = 'utf-8',
  UTF16 = 'utf-16',
  ASCII = 'ascii',
  BASE64 = 'base64'
}

/**
 * Represents a destination for output
 */
export class OutputDestination {
  constructor(
    private readonly type: 'file' | 'stream' | 'buffer',
    private readonly target: string | WritableStream | Buffer
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.type === 'file' && typeof this.target !== 'string') {
      throw new Error('File destination must have string path');
    }
  }

  getType(): string {
    return this.type;
  }

  getTarget(): string | WritableStream | Buffer {
    return this.target;
  }

  isFile(): boolean {
    return this.type === 'file';
  }

  getFilePath(): string {
    if (!this.isFile()) {
      throw new Error('Destination is not a file');
    }
    return this.target as string;
  }
}

/**
 * Output specification for rendering
 */
export interface OutputSpecification {
  format: OutputFormat;
  destination: OutputDestination;
  encoding: OutputEncoding;
  options?: Record<string, unknown>;
}

/**
 * Result type for domain operations
 */
export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Creates a successful result
 */
export function success<T>(data: T): Result<T> {
  return { ok: true, data };
}

/**
 * Creates a failed result
 */
export function failure<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard for successful results
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { ok: true; data: T } {
  return result.ok === true;
}

/**
 * Type guard for failed results
 */
export function isFailure<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}