import { Result } from "../../shared/types/result.ts";
import { ProcessingError } from "../../shared/types/errors.ts";
import { FilePath } from "../../shared/value-objects/file-path.ts";
import { DocumentId, MarkdownDocument } from "../entities/markdown-document.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { FileSystemPort } from "../../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../shared/types/file-errors.ts";

/**
 * Domain service for parsing frontmatter from markdown documents.
 * Follows totality principles with comprehensive Result-based error handling.
 */
export class FrontmatterParsingService {
  private constructor(private readonly fileSystem: FileSystemPort) {}

  /**
   * Creates a FrontmatterParsingService instance.
   */
  static create(
    fileSystem: FileSystemPort,
  ): Result<FrontmatterParsingService, ProcessingError> {
    if (!fileSystem) {
      return Result.error(
        new ProcessingError(
          "FileSystemPort is required for frontmatter parsing",
          "INVALID_DEPENDENCY",
          { dependency: "FileSystemPort" },
        ),
      );
    }

    return Result.ok(new FrontmatterParsingService(fileSystem));
  }

  /**
   * Loads and parses a markdown document from file path.
   * Creates a complete MarkdownDocument entity with frontmatter data.
   */
  async loadMarkdownDocument(
    filePath: string,
  ): Promise<Result<MarkdownDocument, ProcessingError>> {
    // Read file using FileSystemPort
    const contentResult = await this.fileSystem.readTextFile(filePath);
    if (contentResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to read document: ${
            createFileError(contentResult.unwrapError()).message
          }`,
          "DOCUMENT_READ_ERROR",
          { filePath, error: contentResult.unwrapError() },
        ),
      );
    }

    // Create file path object
    const filePathResult = FilePath.create(filePath);
    if (filePathResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Invalid file path: ${filePathResult.unwrapError().message}`,
          "INVALID_FILE_PATH",
          { filePath },
        ),
      );
    }

    // Parse frontmatter
    const frontmatterResult = this.parseFrontmatter(contentResult.unwrap());
    if (frontmatterResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Frontmatter parsing failed: ${frontmatterResult.unwrapError().message}`,
          "FRONTMATTER_PARSE_ERROR",
          { filePath, error: frontmatterResult.unwrapError() },
        ),
      );
    }

    const { frontmatter, content: markdownContent } = frontmatterResult
      .unwrap();

    // Create document ID and entity
    const documentId = DocumentId.fromPath(filePathResult.unwrap());

    // Handle frontmatter data creation safely
    let frontmatterData: FrontmatterData | undefined;
    if (frontmatter) {
      const frontmatterDataResult = FrontmatterData.create(frontmatter);
      if (frontmatterDataResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Invalid frontmatter data: ${frontmatterDataResult.unwrapError().message}`,
            "INVALID_FRONTMATTER_DATA",
            { filePath, error: frontmatterDataResult.unwrapError() },
          ),
        );
      }
      frontmatterData = frontmatterDataResult.unwrap();
    }

    const document = MarkdownDocument.create(
      documentId,
      filePathResult.unwrap(),
      markdownContent,
      frontmatterData,
    );

    return Result.ok(document);
  }

  /**
   * Parses frontmatter from markdown content.
   * Returns Result type following totality principles.
   */
  parseFrontmatter(
    content: string,
  ): Result<
    { frontmatter?: Record<string, unknown>; content: string },
    ProcessingError
  > {
    if (typeof content !== "string") {
      return Result.error(
        new ProcessingError(
          "Content must be a string for frontmatter parsing",
          "INVALID_CONTENT_TYPE",
          { contentType: typeof content },
        ),
      );
    }

    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return Result.ok({ content });
    }

    try {
      // Simple YAML parsing - in production would use proper YAML parser
      const yamlContent = match[1];
      const markdownContent = match[2];

      // Basic key-value parsing (simplified)
      const frontmatter: Record<string, unknown> = {};
      const lines = yamlContent.split("\n");

      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();

          // Handle YAML comments: remove everything after # (but only if not inside quotes)
          // Check if value starts with a quote
          const startsWithQuote = value.startsWith('"') ||
            value.startsWith("'");
          if (startsWithQuote) {
            const quoteChar = value[0];
            // Find the matching closing quote
            const endQuoteIndex = value.indexOf(quoteChar, 1);
            if (endQuoteIndex > 0) {
              // Extract just the quoted value (excluding the quotes)
              value = value.substring(1, endQuoteIndex);
            }
          } else {
            // No quotes, so check for comment and remove it
            const commentIndex = value.indexOf("#");
            if (commentIndex >= 0) {
              value = value.substring(0, commentIndex).trim();
            }
          }

          frontmatter[key] = value;
        }
      }

      return Result.ok({ frontmatter, content: markdownContent });
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to parse YAML frontmatter: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "YAML_PARSE_ERROR",
          { error },
        ),
      );
    }
  }
}
