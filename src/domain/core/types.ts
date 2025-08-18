/**
 * Core domain types for the generic frontmatter analysis system
 * Enhanced with Totality principles: Smart Constructors and Result types
 */

import { type Result, type ValidationError, createDomainError } from "./result.ts";

/**
 * Validated file path with Smart Constructor
 * Eliminates invalid file paths at construction time
 */
export class ValidFilePath {
  private constructor(readonly value: string) {}

  static create(path: string): Result<ValidFilePath, ValidationError & { message: string }> {
    // Input validation
    if (!path || path.trim().length === 0) {
      return { 
        ok: false, 
        error: createDomainError({ kind: "EmptyInput" })
      };
    }

    const cleanPath = path.trim();
    
    // Path length validation
    if (cleanPath.length > 512) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "TooLong", 
          value: cleanPath, 
          maxLength: 512 
        })
      };
    }

    // Basic path validation - no null bytes or invalid characters
    if (cleanPath.includes('\0') || cleanPath.includes('\r') || cleanPath.includes('\n')) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "InvalidFormat", 
          input: cleanPath, 
          expectedFormat: "valid file path without control characters" 
        })
      };
    }

    return { ok: true, data: new ValidFilePath(cleanPath) };
  }

  static createMarkdown(path: string): Result<ValidFilePath, ValidationError & { message: string }> {
    const baseResult = ValidFilePath.create(path);
    
    if (!baseResult.ok) {
      return baseResult;
    }

    if (!baseResult.data.isMarkdown()) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "FileExtensionMismatch", 
          path: baseResult.data.value, 
          expected: [".md"] 
        })
      };
    }

    return baseResult;
  }

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
 * Validated frontmatter content with Smart Constructor
 * Eliminates invalid YAML parsing and provides type-safe access
 */
export class FrontMatterContent {
  private constructor(readonly data: Record<string, unknown>) {}

  static fromYaml(yamlContent: string): Result<FrontMatterContent, ValidationError & { message: string }> {
    if (!yamlContent || yamlContent.trim().length === 0) {
      return { 
        ok: false, 
        error: createDomainError({ kind: "EmptyInput" })
      };
    }

    try {
      // Simple YAML parsing for frontmatter - basic key-value pairs
      const data: Record<string, unknown> = {};
      const lines = yamlContent.trim().split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = trimmed.slice(0, colonIndex).trim();
        let valueStr = trimmed.slice(colonIndex + 1).trim();
        
        // Remove inline comments (everything after # that isn't within quotes)
        const hashIndex = valueStr.indexOf('#');
        if (hashIndex !== -1) {
          // Check if the # is inside quotes
          const beforeHash = valueStr.slice(0, hashIndex);
          const quoteCount = (beforeHash.match(/"/g) || []).length;
          if (quoteCount % 2 === 0) {
            // Even number of quotes means # is outside of quotes
            valueStr = valueStr.slice(0, hashIndex).trim();
          }
        }
        
        // Parse basic types
        let value: unknown = valueStr;
        if (valueStr.toLowerCase() === 'true') value = true;
        else if (valueStr.toLowerCase() === 'false') value = false;
        else if (/^-?\d+\.?\d*$/.test(valueStr)) {
          // Handle both integers and decimals
          value = valueStr.includes('.') ? parseFloat(valueStr) : parseInt(valueStr, 10);
        }
        else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
          // Handle arrays like ["alice", "bob", "charlie"]
          try {
            value = JSON.parse(valueStr);
          } catch {
            // Fallback to string if JSON parsing fails
            value = valueStr;
          }
        }
        else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
          value = valueStr.slice(1, -1);
        }
        
        data[key] = value;
      }

      return { ok: true, data: new FrontMatterContent(data) };
    } catch (error) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "ParseError", 
          input: yamlContent, 
          details: error instanceof Error ? error.message : String(error)
        })
      };
    }
  }

  static fromObject(obj: Record<string, unknown>): Result<FrontMatterContent, ValidationError & { message: string }> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "InvalidFormat", 
          input: String(obj), 
          expectedFormat: "object" 
        })
      };
    }

    return { ok: true, data: new FrontMatterContent(obj) };
  }

  get(key: string): unknown {
    return this.data[key];
  }

  getTyped<T>(key: string, validator: (value: unknown) => value is T): T | undefined {
    const value = this.data[key];
    return validator(value) ? value : undefined;
  }

  has(key: string): boolean {
    return key in this.data;
  }

  keys(): string[] {
    return Object.keys(this.data);
  }

  size(): number {
    return Object.keys(this.data).length;
  }
}

/**
 * Validated schema definition with Smart Constructor
 * Ensures schema validity at construction time
 */
export class SchemaDefinition<T = unknown> {
  private constructor(readonly schema: T) {}

  static create<T>(schema: T): Result<SchemaDefinition<T>, ValidationError & { message: string }> {
    if (!schema) {
      return { 
        ok: false, 
        error: createDomainError({ kind: "EmptyInput" })
      };
    }

    // Basic schema structure validation
    if (typeof schema !== "object" || Array.isArray(schema)) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "InvalidFormat", 
          input: String(schema), 
          expectedFormat: "object schema" 
        })
      };
    }

    return { ok: true, data: new SchemaDefinition(schema) };
  }

  static fromJsonString<T = unknown>(jsonSchema: string): Result<SchemaDefinition<T>, ValidationError & { message: string }> {
    if (!jsonSchema || jsonSchema.trim().length === 0) {
      return { 
        ok: false, 
        error: createDomainError({ kind: "EmptyInput" })
      };
    }

    try {
      const parsed = JSON.parse(jsonSchema.trim());
      return SchemaDefinition.create<T>(parsed);
    } catch (error) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "ParseError", 
          input: jsonSchema, 
          details: error instanceof Error ? error.message : String(error)
        })
      };
    }
  }

  validate(data: unknown): Result<boolean, ValidationError & { message: string }> {
    // Basic validation - can be extended with JSON Schema, Zod, etc.
    if (!this.schema || typeof this.schema !== "object") {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "InvalidFormat", 
          input: String(this.schema), 
          expectedFormat: "valid schema object" 
        })
      };
    }

    // For now, basic existence check - can be enhanced with actual schema validation
    if (data === null || data === undefined) {
      return { 
        ok: false, 
        error: createDomainError({ kind: "EmptyInput" })
      };
    }

    return { ok: true, data: true };
  }
}

/**
 * Validated source file with Smart Constructor
 * Ensures valid file state at construction time
 */
export class SourceFile {
  private constructor(
    readonly path: ValidFilePath,
    readonly frontMatter: FrontMatterContent | null,
    readonly content: string,
  ) {}

  static create(
    path: ValidFilePath,
    content: string,
    frontMatter?: FrontMatterContent
  ): Result<SourceFile, ValidationError & { message: string }> {
    if (!content && content !== "") {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "InvalidFormat", 
          input: String(content), 
          expectedFormat: "string content" 
        })
      };
    }

    return { 
      ok: true, 
      data: new SourceFile(path, frontMatter || null, content) 
    };
  }

  hasFrontMatter(): boolean {
    return this.frontMatter !== null;
  }

  extractFrontMatter(): Result<FrontMatterContent, ValidationError & { message: string }> {
    if (!this.frontMatter) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "InvalidFormat", 
          input: this.content, 
          expectedFormat: "content with frontmatter" 
        })
      };
    }

    return { ok: true, data: this.frontMatter };
  }
}

/**
 * Validated analysis result with Strong typing
 */
export class AnalysisResult<T = unknown> {
  constructor(
    readonly sourceFile: ValidFilePath,
    readonly extractedData: T,
    readonly metadata: Map<string, unknown> = new Map(),
  ) {}

  addMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
  }

  getMetadata(key: string): unknown {
    return this.metadata.get(key);
  }

  hasMetadata(key: string): boolean {
    return this.metadata.has(key);
  }

  getTypedMetadata<T>(key: string, validator: (value: unknown) => value is T): T | undefined {
    const value = this.metadata.get(key);
    return validator(value) ? value : undefined;
  }
}

/**
 * Discriminated Union for Analysis Context - replaces optional properties
 * Following Totality principles to eliminate partial functions
 */
export type AnalysisContext = 
  | { 
      kind: "SchemaAnalysis"; 
      schema: SchemaDefinition; 
      options: AnalysisOptions 
    }
  | { 
      kind: "TemplateMapping"; 
      template: TemplateDefinition; 
      schema?: SchemaDefinition 
    }
  | { 
      kind: "ValidationOnly"; 
      schema: SchemaDefinition 
    }
  | { 
      kind: "BasicExtraction"; 
      options: AnalysisOptions 
    };

/**
 * Analysis options for configuration
 */
export interface AnalysisOptions {
  readonly includeMetadata?: boolean;
  readonly validateResults?: boolean;
  readonly timeoutMs?: number;
  readonly customOptions?: Record<string, unknown>;
}

/**
 * Template definition for mapping operations
 */
export interface TemplateDefinition {
  readonly structure: Record<string, unknown>;
  readonly mappingRules?: Record<string, unknown>;
}

/**
 * Helper functions for AnalysisContext type guards
 */
export const isSchemaAnalysis = (
  context: AnalysisContext
): context is Extract<AnalysisContext, { kind: "SchemaAnalysis" }> => {
  return context.kind === "SchemaAnalysis";
};

export const isTemplateMapping = (
  context: AnalysisContext
): context is Extract<AnalysisContext, { kind: "TemplateMapping" }> => {
  return context.kind === "TemplateMapping";
};

export const isValidationOnly = (
  context: AnalysisContext
): context is Extract<AnalysisContext, { kind: "ValidationOnly" }> => {
  return context.kind === "ValidationOnly";
};

export const isBasicExtraction = (
  context: AnalysisContext
): context is Extract<AnalysisContext, { kind: "BasicExtraction" }> => {
  return context.kind === "BasicExtraction";
};

// Legacy AnalysisContextGuards for backward compatibility
export const AnalysisContextGuards = {
  isSchemaAnalysis,
  isTemplateMapping,
  isValidationOnly,
  isBasicExtraction,
};
