/**
 * File Operations - Document discovery and I/O operations
 * Following DDD and Totality principles
 * Part of Application Layer - Document Processing Context
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import { FILE_PATTERNS } from "../../domain/constants/index.ts";
import { Document } from "../../domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
} from "../../domain/models/value-objects.ts";
import type { FileSystemPort } from "../../infrastructure/ports/index.ts";
import type { FrontMatterExtractor } from "../../domain/services/interfaces.ts";
import type { InputConfiguration, OutputFormat } from "../configuration.ts";

/**
 * Type guard for file content validation
 */
function isValidFileContent(content: unknown): content is string {
  return typeof content === "string" && content.length > 0;
}

/**
 * File operations service for document processing
 * Handles file discovery, reading, and output generation
 */
export class FileOperations {
  constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly frontMatterExtractor?: FrontMatterExtractor,
  ) {}

  /**
   * Discover documents based on input configuration
   */
  async discoverDocuments(
    input: InputConfiguration,
  ): Promise<Result<Document[], DomainError>> {
    try {
      switch (input.kind) {
        case "FileInput": {
          // Handle single file input
          const documentResult = await this.loadDocument(input.path);
          if (documentResult.ok) {
            return { ok: true, data: [documentResult.data] };
          } else {
            return {
              ok: false,
              error: createDomainError({
                kind: "FileNotFound",
                path: input.path,
              }, `Failed to load single file: ${input.path}`),
            };
          }
        }
        case "DirectoryInput": {
          // Handle directory input with pattern
          const pattern = input.pattern || FILE_PATTERNS.MARKDOWN;

          // Find matching files using listFiles
          const filesResult = await this.fileSystem.listFiles(
            input.path,
            pattern,
          );
          if (!filesResult.ok) {
            return {
              ok: false,
              error: createDomainError({
                kind: "FileDiscoveryFailed",
                directory: input.path,
                pattern,
              }, `Failed to discover files with pattern: ${pattern}`),
            };
          }

          const filePaths = filesResult.data.map((f) => f.path);

          // Filter and validate files
          const documents: Document[] = [];
          for (const filePath of filePaths) {
            const documentResult = await this.loadDocument(filePath);
            if (documentResult.ok) {
              documents.push(documentResult.data);
            }
            // Continue processing other files even if one fails (resilient approach)
          }

          return { ok: true, data: documents };
        }
        default: {
          // Exhaustive check
          const _exhaustive: never = input;
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "ProcessingStageError",
                stage: "document-discovery",
                error: createDomainError({
                  kind: "InvalidFormat",
                  input: JSON.stringify(_exhaustive),
                  expectedFormat: "FileInput or DirectoryInput",
                }),
              },
              `Unknown input configuration: ${JSON.stringify(_exhaustive)}`,
            ),
          };
        }
      }
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "document-discovery",
            error: createDomainError({
              kind: "ReadError",
              path: JSON.stringify(input),
              details: error instanceof Error ? error.message : String(error),
            }),
          },
          `Document discovery failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Load a single document from file path
   */
  private async loadDocument(
    filePath: string,
  ): Promise<Result<Document, DomainError>> {
    // Create document path value object
    const pathResult = DocumentPath.create(filePath);
    if (!pathResult.ok) {
      return pathResult;
    }
    const documentPath = pathResult.data;

    // Read file content
    const contentResult = await this.fileSystem.readFile(filePath);
    if (!contentResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: filePath,
          details: "Failed to read file content",
        }, `Failed to read file: ${filePath}`),
      };
    }

    // Validate content
    if (!isValidFileContent(contentResult.data)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "file content",
          expectedFormat: "non-empty string",
        }, `File content is empty or invalid: ${filePath}`),
      };
    }

    // Create document content value object
    const contentObj = DocumentContent.create(contentResult.data);
    if (!contentObj.ok) {
      return contentObj;
    }

    // Create a basic document first
    const basicDoc = Document.createWithFrontMatter(
      documentPath,
      null,
      contentObj.data,
    );

    // Extract frontmatter if extractor is available
    if (this.frontMatterExtractor) {
      const extractionResult = this.frontMatterExtractor.extract(basicDoc);
      if (extractionResult.ok) {
        // Create updated document with extracted frontmatter if found
        const document = extractionResult.data.kind === "Extracted"
          ? Document.createWithFrontMatter(
            documentPath,
            extractionResult.data.frontMatter,
            contentObj.data,
          )
          : basicDoc;

        return {
          ok: true,
          data: document,
        };
      }
    }

    // Return basic document if no extractor or extraction failed
    return {
      ok: true,
      data: basicDoc,
    };
  }

  /**
   * Generate output file based on configuration
   */
  async generateOutput(
    data: unknown,
    outputPath: string,
    format: OutputFormat,
  ): Promise<Result<void, DomainError>> {
    try {
      // Convert data to appropriate format
      const contentResult = this.formatData(data, format);
      if (!contentResult.ok) {
        return contentResult;
      }

      // Write to file
      const writeResult = await this.fileSystem.writeFile(
        outputPath,
        contentResult.data,
      );
      if (!writeResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "WriteError",
            path: outputPath,
            details: "Failed to write output file",
          }, `Failed to write output file: ${outputPath}`),
        };
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "output-generation",
            error: createDomainError({
              kind: "WriteError",
              path: outputPath,
              details: error instanceof Error ? error.message : String(error),
            }),
          },
          `Output generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Format data according to output format
   */
  private formatData(
    data: unknown,
    format: OutputFormat,
  ): Result<string, DomainError> {
    try {
      switch (format.getValue()) {
        case "json":
          return { ok: true, data: JSON.stringify(data, null, 2) };
        case "yaml":
          return { ok: true, data: this.convertToYaml(data, 0) };
        case "xml":
          return { ok: true, data: this.convertToXml(data) };
        case "custom":
          return { ok: true, data: this.convertToMarkdown(data) };
        default:
          // Exhaustive check for OutputFormat
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: format.getValue(),
              expectedFormat: "json, yaml, xml, or custom",
            }, `Unsupported output format: ${format.getValue()}`),
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "SerializationError",
            data: String(data),
            format: format.getValue(),
          },
          `Failed to format data: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Convert data to YAML format
   */
  private convertToYaml(data: unknown, indent: number): string {
    // Simple YAML conversion - could be enhanced with a proper YAML library
    const spaces = "  ".repeat(indent);

    if (data === null) return "null";
    if (typeof data === "string") return `"${data.replace(/"/g, '\\"')}"`;
    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return "[]";
      return "\n" +
        data.map((item) =>
          `${spaces}- ${
            this.convertToYaml(item, indent + 1).replace(/^\s+/, "")
          }`
        ).join("\n");
    }

    if (typeof data === "object" && data !== null) {
      const entries = Object.entries(data);
      if (entries.length === 0) return "{}";
      return "\n" +
        entries.map(([key, value]) =>
          `${spaces}${key}: ${
            this.convertToYaml(value, indent + 1).replace(/^\s+/, "")
          }`
        ).join("\n");
    }

    return String(data);
  }

  /**
   * Convert data to XML format
   */
  private convertToXml(data: unknown): string {
    // Simple XML conversion
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return `<root>${String(data)}</root>`;
    }

    const entries = Object.entries(data);
    const xmlContent = entries.map(([key, value]) => {
      if (
        typeof value === "object" && value !== null && !Array.isArray(value)
      ) {
        return `<${key}>${
          this.convertToXml(value).replace(/<\/?root>/g, "")
        }</${key}>`;
      }
      return `<${key}>${String(value)}</${key}>`;
    }).join("");

    return `<root>${xmlContent}</root>`;
  }

  /**
   * Convert data to Markdown format
   */
  private convertToMarkdown(data: unknown): string {
    if (typeof data !== "object" || data === null) {
      return String(data);
    }

    if (Array.isArray(data)) {
      return data.map((item, index) =>
        `${index + 1}. ${this.convertToMarkdown(item)}`
      ).join("\n");
    }

    const entries = Object.entries(data);
    return entries.map(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        return `## ${key}\n\n${this.convertToMarkdown(value)}\n`;
      }
      return `**${key}**: ${String(value)}\n`;
    }).join("\n");
  }
}
