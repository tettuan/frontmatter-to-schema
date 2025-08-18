/**
 * Core domain types for the generic frontmatter analysis system
 */

/**
 * Represents a file path in the system
 */
export class FilePath {
  constructor(readonly value: string) {}

  isMarkdown(): boolean {
    return this.value.endsWith(".md");
  }

  get filename(): string {
    return this.value.split("/").pop() || "";
  }

  get directory(): string {
    const parts = this.value.split("/");
    parts.pop();
    return parts.join("/");
  }
}

/**
 * Generic frontmatter content container
 */
export class FrontMatterContent {
  constructor(readonly data: Record<string, unknown>) {}

  get(key: string): unknown {
    return this.data[key];
  }

  has(key: string): boolean {
    return key in this.data;
  }

  keys(): string[] {
    return Object.keys(this.data);
  }
}

/**
 * Generic schema definition for validation and typing
 */
export class SchemaDefinition<T = unknown> {
  constructor(readonly schema: T) {}

  validate(_data: unknown): boolean {
    // Basic validation - can be extended with JSON Schema, Zod, etc.
    if (!this.schema || typeof this.schema !== "object") {
      return false;
    }
    return true;
  }
}

/**
 * Represents a source file with its content and metadata
 */
export class SourceFile {
  constructor(
    readonly path: FilePath,
    readonly frontMatter: FrontMatterContent | null,
    readonly content: string,
  ) {}

  hasFrontMatter(): boolean {
    return this.frontMatter !== null;
  }
}

/**
 * Generic analysis result container
 */
export class AnalysisResult<T = unknown> {
  constructor(
    readonly sourceFile: FilePath,
    readonly extractedData: T,
    readonly metadata: Map<string, unknown> = new Map(),
  ) {}

  addMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
  }

  getMetadata(key: string): unknown {
    return this.metadata.get(key);
  }
}

/**
 * Analysis context for providing additional information during processing
 */
export interface AnalysisContext {
  schema?: SchemaDefinition;
  template?: unknown;
  options?: Record<string, unknown>;
}
