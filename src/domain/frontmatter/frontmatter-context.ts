/**
 * Frontmatter Context - Canonical Domain Service
 *
 * Consolidates all frontmatter operations into a single bounded context
 * following DDD principles and Totality patterns.
 *
 * Replaces multiple frontmatter services with one authoritative implementation
 * for the Issue #591 10-file architecture.
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";
import type { DocumentPath } from "../value-objects/document-path.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";

/**
 * Extracted frontmatter with metadata
 */
export interface ExtractedFrontmatter {
  readonly frontmatter: FrontmatterData;
  readonly content: string; // Document content without frontmatter
  readonly originalDocument: string;
  readonly extractionMethod: "yaml" | "json" | "toml";
  readonly lineNumbers: {
    readonly start: number;
    readonly end: number;
  };
}

/**
 * Parsed document structure
 */
export interface ParsedDocument {
  readonly path: DocumentPath;
  readonly frontmatter: FrontmatterData;
  readonly content: string;
  readonly metadata: DocumentMetadata;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  readonly size: number;
  readonly encoding: string;
  readonly lastModified: Date;
  readonly hasValidFrontmatter: boolean;
}

/**
 * Frontmatter extraction options
 */
export interface ExtractionOptions {
  readonly strict: boolean;
  readonly allowEmptyFrontmatter: boolean;
  readonly preserveContent: boolean;
  readonly validateStructure: boolean;
}

/**
 * Frontmatter Context - Single Canonical Frontmatter Processing Service
 *
 * Responsibilities:
 * - Document reading and parsing
 * - Frontmatter extraction from Markdown files
 * - Content separation and validation
 * - Format detection (YAML/JSON/TOML)
 *
 * Consolidates:
 * - UnifiedFrontmatterExtractor
 * - FrontmatterProcessor
 * - Multiple extraction adapters
 */
export class FrontmatterContext {
  private readonly defaultOptions: ExtractionOptions = {
    strict: false,
    allowEmptyFrontmatter: true,
    preserveContent: true,
    validateStructure: true,
  };

  /**
   * Extract frontmatter from a document file
   * Primary entry point for frontmatter processing
   */
  async extractFromFile(
    documentPath: DocumentPath,
    options: Partial<ExtractionOptions> = {},
  ): Promise<Result<ParsedDocument, DomainError & { message: string }>> {
    const extractionOptions = { ...this.defaultOptions, ...options };

    try {
      // 1. Read document from file system
      const documentResult = await this.readDocument(documentPath);
      if (!documentResult.ok) {
        return documentResult;
      }

      // 2. Extract frontmatter from content
      const frontmatterResult = this.extractFrontmatter(
        documentResult.data.content,
        extractionOptions,
      );
      if (!frontmatterResult.ok) {
        return frontmatterResult;
      }

      // 3. Create parsed document
      const parsedDocument: ParsedDocument = {
        path: documentPath,
        frontmatter: frontmatterResult.data.frontmatter,
        content: frontmatterResult.data.content,
        metadata: documentResult.data.metadata,
      };

      return { ok: true, data: parsedDocument };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ExtractionError",
            reason: String(error),
          },
          `Failed to extract frontmatter from ${documentPath.getValue()}: ${error}`,
        ),
      };
    }
  }

  /**
   * Extract frontmatter from document content
   * Alternative entry point for in-memory content
   */
  extractFrontmatter(
    documentContent: string,
    options: Partial<ExtractionOptions> = {},
  ): Result<ExtractedFrontmatter, DomainError & { message: string }> {
    const extractionOptions = { ...this.defaultOptions, ...options };

    if (!documentContent || documentContent.trim() === "") {
      if (!extractionOptions.allowEmptyFrontmatter) {
        return {
          ok: false,
          error: createDomainError(
            { kind: "EmptyInput" },
            "Document content cannot be empty",
          ),
        };
      }

      // Return empty frontmatter for empty documents
      const emptyFrontmatterResult = FrontmatterData.createFromParsed({
        _empty: true,
      }, "yaml");
      if (!emptyFrontmatterResult.ok) {
        return emptyFrontmatterResult;
      }

      return {
        ok: true,
        data: {
          frontmatter: emptyFrontmatterResult.data,
          content: "",
          originalDocument: documentContent,
          extractionMethod: "yaml",
          lineNumbers: { start: 0, end: 0 },
        },
      };
    }

    // 1. Detect frontmatter format and boundaries
    const formatResult = this.detectFrontmatterFormat(documentContent);
    if (!formatResult.ok) {
      return formatResult;
    }

    // 2. Extract frontmatter content
    const extractionResult = this.extractFrontmatterContent(
      documentContent,
      formatResult.data,
    );
    if (!extractionResult.ok) {
      return extractionResult;
    }

    // 3. Parse frontmatter data
    const frontmatterResult = this.parseFrontmatterData(
      extractionResult.data.frontmatterText,
      formatResult.data.method,
      extractionOptions,
    );
    if (!frontmatterResult.ok) {
      return frontmatterResult;
    }

    // 4. Create extracted frontmatter result
    const extractedFrontmatter: ExtractedFrontmatter = {
      frontmatter: frontmatterResult.data,
      content: extractionResult.data.content,
      originalDocument: documentContent,
      extractionMethod: formatResult.data.method,
      lineNumbers: formatResult.data.lineNumbers,
    };

    return { ok: true, data: extractedFrontmatter };
  }

  /**
   * Parse frontmatter data from raw content
   */
  parseRawFrontmatter(
    frontmatterText: string,
    format: "yaml" | "json" | "toml" = "yaml",
  ): Result<FrontmatterData, DomainError & { message: string }> {
    return this.parseFrontmatterData(
      frontmatterText,
      format,
      this.defaultOptions,
    );
  }

  /**
   * Validate document has valid frontmatter
   */
  validateFrontmatter(
    documentContent: string,
  ): Result<boolean, DomainError & { message: string }> {
    const formatResult = this.detectFrontmatterFormat(documentContent);

    if (!formatResult.ok) {
      // No frontmatter found is considered valid (empty frontmatter)
      if (formatResult.error.kind === "NoFrontMatterPresent") {
        return { ok: true, data: false };
      }
      return formatResult;
    }

    return { ok: true, data: true };
  }

  // Private implementation methods

  /**
   * Read document from file system
   */
  private async readDocument(
    documentPath: DocumentPath,
  ): Promise<
    Result<
      { content: string; metadata: DocumentMetadata },
      DomainError & { message: string }
    >
  > {
    try {
      const pathValue = documentPath.getValue();

      // Read file content
      const content = await Deno.readTextFile(pathValue);

      // Get file stats
      const stats = await Deno.stat(pathValue);

      const metadata: DocumentMetadata = {
        size: stats.size,
        encoding: "utf-8",
        lastModified: stats.mtime || new Date(),
        hasValidFrontmatter: false, // Will be updated after extraction
      };

      return {
        ok: true,
        data: { content, metadata },
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "FileNotFound",
              path: documentPath.getValue(),
            },
            `Document file not found: ${documentPath.getValue()}`,
          ),
        };
      }

      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "PermissionDenied",
              path: documentPath.getValue(),
              operation: "read",
            },
            `Permission denied reading document: ${documentPath.getValue()}`,
          ),
        };
      }

      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ReadError",
            path: documentPath.getValue(),
            details: String(error),
          },
          `Failed to read document: ${error}`,
        ),
      };
    }
  }

  /**
   * Detect frontmatter format and boundaries
   */
  private detectFrontmatterFormat(
    content: string,
  ): Result<
    {
      method: "yaml" | "json" | "toml";
      lineNumbers: { start: number; end: number };
    },
    DomainError & { message: string }
  > {
    const lines = content.split("\n");

    // Check for YAML frontmatter (---)
    if (lines[0]?.trim() === "---") {
      const endIndex = lines.findIndex((line, index) =>
        index > 0 && line.trim() === "---"
      );

      if (endIndex > 0) {
        return {
          ok: true,
          data: {
            method: "yaml",
            lineNumbers: { start: 0, end: endIndex },
          },
        };
      }
    }

    // Check for JSON frontmatter ({)
    if (lines[0]?.trim().startsWith("{")) {
      let braceCount = 0;
      let endIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;

        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }

      if (endIndex > 0) {
        return {
          ok: true,
          data: {
            method: "json",
            lineNumbers: { start: 0, end: endIndex },
          },
        };
      }
    }

    // Check for TOML frontmatter (+++)
    if (lines[0]?.trim() === "+++") {
      const endIndex = lines.findIndex((line, index) =>
        index > 0 && line.trim() === "+++"
      );

      if (endIndex > 0) {
        return {
          ok: true,
          data: {
            method: "toml",
            lineNumbers: { start: 0, end: endIndex },
          },
        };
      }
    }

    return {
      ok: false,
      error: createDomainError(
        { kind: "NoFrontMatterPresent" },
        "No frontmatter detected in document",
      ),
    };
  }

  /**
   * Extract frontmatter content from document
   */
  private extractFrontmatterContent(
    content: string,
    format: {
      method: "yaml" | "json" | "toml";
      lineNumbers: { start: number; end: number };
    },
  ): Result<
    { frontmatterText: string; content: string },
    DomainError & { message: string }
  > {
    const lines = content.split("\n");

    let frontmatterLines: string[];
    let contentLines: string[];

    switch (format.method) {
      case "yaml":
      case "toml":
        // Skip the opening and closing delimiters
        frontmatterLines = lines.slice(
          format.lineNumbers.start + 1,
          format.lineNumbers.end,
        );
        contentLines = lines.slice(format.lineNumbers.end + 1);
        break;

      case "json":
        // Include all lines from start to end
        frontmatterLines = lines.slice(
          format.lineNumbers.start,
          format.lineNumbers.end + 1,
        );
        contentLines = lines.slice(format.lineNumbers.end + 1);
        break;

      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: format.method,
              expectedFormat: "yaml | json | toml",
            },
            `Unsupported frontmatter format: ${format.method}`,
          ),
        };
    }

    const frontmatterText = frontmatterLines.join("\n").trim();
    const remainingContent = contentLines.join("\n").trim();

    return {
      ok: true,
      data: {
        frontmatterText,
        content: remainingContent,
      },
    };
  }

  /**
   * Parse frontmatter data from text
   */
  private parseFrontmatterData(
    frontmatterText: string,
    format: "yaml" | "json" | "toml",
    options: ExtractionOptions,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (!frontmatterText.trim()) {
      if (!options.allowEmptyFrontmatter) {
        return {
          ok: false,
          error: createDomainError(
            { kind: "EmptyInput" },
            "Frontmatter cannot be empty",
          ),
        };
      }

      return FrontmatterData.createFromParsed({ _empty: true }, "yaml");
    }

    try {
      let parsed: Record<string, unknown>;

      switch (format) {
        case "yaml":
          // Basic YAML parsing - in production would use a YAML library
          parsed = this.parseSimpleYaml(frontmatterText);
          break;

        case "json":
          parsed = JSON.parse(frontmatterText);
          break;

        case "toml":
          // Basic TOML parsing - in production would use a TOML library
          parsed = this.parseSimpleToml(frontmatterText);
          break;

        default:
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: format,
                expectedFormat: "yaml | json | toml",
              },
              `Unsupported frontmatter format: ${format}`,
            ),
          };
      }

      // Validate structure if required
      if (options.validateStructure && !this.isValidStructure(parsed)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: frontmatterText,
              expectedFormat: "valid object structure",
            },
            "Frontmatter must be a valid object structure",
          ),
        };
      }

      return FrontmatterData.createFromParsed(parsed, format);
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ParseError",
            input: frontmatterText,
            parser: format,
            details: String(error),
          },
          `Failed to parse ${format} frontmatter: ${error}`,
        ),
      };
    }
  }

  /**
   * Simple YAML parser (basic implementation)
   */
  private parseSimpleYaml(yamlText: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yamlText.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      // Basic value parsing
      if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else if (/^\d+$/.test(value)) {
        result[key] = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        result[key] = parseFloat(value);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        result[key] = value.slice(1, -1);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Simple TOML parser (basic implementation)
   */
  private parseSimpleToml(tomlText: string): Record<string, unknown> {
    // Basic TOML parsing - similar to YAML but with TOML syntax
    const result: Record<string, unknown> = {};
    const lines = tomlText.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalIndex = trimmed.indexOf("=");
      if (equalIndex === -1) continue;

      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      // Basic value parsing (similar to YAML)
      if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else if (/^\d+$/.test(value)) {
        result[key] = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        result[key] = parseFloat(value);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        result[key] = value.slice(1, -1);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Validate that parsed data has valid structure
   */
  private isValidStructure(data: unknown): boolean {
    return (
      typeof data === "object" &&
      data !== null &&
      !Array.isArray(data)
    );
  }
}
