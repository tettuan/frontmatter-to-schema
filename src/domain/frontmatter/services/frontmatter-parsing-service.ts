import { Result } from "../../shared/types/result.ts";
import { ProcessingError } from "../../shared/types/errors.ts";
import { FilePath } from "../../shared/value-objects/file-path.ts";
import { DocumentId, MarkdownDocument } from "../entities/markdown-document.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { FileSystemPort } from "../../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../shared/types/file-errors.ts";
import { extract as extractYaml } from "jsr:@std/front-matter@1.0.5/yaml";
import { Schema, SchemaData } from "../../schema/entities/schema.ts";
import { mapDataToSchema } from "../../../../sub_modules/yaml-schema-mapper/src/mod.ts";

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
   * @param filePath - Path to the markdown file
   * @param schema - Optional schema for Stage 0 transformation (yaml-schema-mapper)
   */
  async loadMarkdownDocument(
    filePath: string,
    schema?: Schema,
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

    // Extract schema data for Stage 0 transformation
    let schemaData: SchemaData | undefined;
    if (schema) {
      // If schema has x-frontmatter-part directive, use items schema for individual documents
      // This ensures each document is validated against the correct schema (e.g., command_schema.json)
      // rather than the container schema (e.g., registry_schema.json)
      const itemsSchema = schema.getFrontmatterPartItemsSchema();

      if (itemsSchema) {
        // Use items schema for Stage 0 processing of individual documents
        schemaData = itemsSchema;
      } else {
        // Use full schema if no x-frontmatter-part directive
        const schemaDataResult = schema.getData();
        if (schemaDataResult.isError()) {
          return Result.error(
            new ProcessingError(
              `Failed to extract schema data: ${schemaDataResult.unwrapError().message}`,
              "SCHEMA_DATA_EXTRACTION_ERROR",
              { filePath, error: schemaDataResult.unwrapError() },
            ),
          );
        }
        schemaData = schemaDataResult.unwrap();
      }
    }

    // Parse frontmatter with schema for Stage 0 transformation
    const frontmatterResult = this.parseFrontmatter(
      contentResult.unwrap(),
      schemaData,
    );
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
   * @param content - Markdown content with frontmatter
   * @param schema - Optional schema for Stage 0 transformation (yaml-schema-mapper)
   */
  parseFrontmatter(
    content: string,
    schema?: SchemaData,
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

    try {
      // Use proper YAML parser from @std/front-matter
      const extracted = extractYaml(content);

      // Stage 0: Apply yaml-schema-mapper transformation if schema provided
      let processedAttrs = extracted.attrs;

      if (
        schema && extracted.attrs && Object.keys(extracted.attrs).length > 0
      ) {
        const transformResult = mapDataToSchema({
          schema: schema as unknown as Record<string, unknown>,
          data: extracted.attrs as Record<string, unknown>,
          options: {
            coerceTypes: true,
            validateTypes: true,
            strict: false,
            allowSafeConversions: true, // Enable safe conversions like [false] -> false
          },
        });

        if (!transformResult.isOk()) {
          const error = transformResult.unwrapError();
          return Result.error(
            new ProcessingError(
              `Schema transformation failed (Stage 0): ${error.message}`,
              "SCHEMA_TRANSFORMATION_ERROR",
              { error, rawData: extracted.attrs },
            ),
          );
        }

        processedAttrs = transformResult.unwrap().data;
      }

      // Return frontmatter and content (even if frontmatter is empty)
      const frontmatter =
        (processedAttrs && Object.keys(processedAttrs).length > 0)
          ? processedAttrs as Record<string, unknown>
          : undefined;

      return Result.ok({
        frontmatter,
        content: extracted.body,
      });
    } catch (error) {
      // If extraction fails, try to return content without frontmatter
      const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        // No frontmatter at all, just return the content
        return Result.ok({ content });
      }

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
