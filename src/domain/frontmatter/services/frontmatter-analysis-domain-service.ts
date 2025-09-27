import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { Schema } from "../../schema/entities/schema.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";

/**
 * フロントマター解析ドメイン (Frontmatter Analysis Domain)
 *
 * 責務: Markdownファイルからフロントマターデータを抽出する
 *
 * 要求:
 * - Markdownファイルの一覧を受け取り、各ファイルを処理する
 * - x-frontmatter-partで指定された階層をフロントマター処理の起点とする
 * - 抽出したデータを構造化して保持する
 * - 外部からの直接アクセスは許可しない
 */
export interface FrontmatterExtractionResult {
  readonly documents: MarkdownDocument[];
  readonly extractedData: FrontmatterData[];
}

export class FrontmatterAnalysisDomainService {
  private extractedResults: FrontmatterExtractionResult | null = null;

  constructor(
    private readonly fileReader: DomainFileReader,
    private readonly fileLister: DomainFileLister,
  ) {}

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
  ): Result<
    FrontmatterAnalysisDomainService,
    DomainError & { message: string }
  > {
    if (!fileReader || !fileLister) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "FileReader and FileLister are required for Frontmatter Analysis Domain",
      }));
    }

    return ok(new FrontmatterAnalysisDomainService(fileReader, fileLister));
  }

  /**
   * Markdownファイルの一覧を受け取り、各ファイルからフロントマターを抽出する
   * x-frontmatter-partで指定された階層をフロントマター処理の起点とする
   */
  async extractFrontmatterData(
    inputPattern: string,
    schema: Schema,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Stage 1: List matching files
    const filesResult = this.fileLister.list(inputPattern);
    if (!filesResult.ok) {
      return filesResult;
    }

    if (filesResult.data.length === 0) {
      return err(createError({
        kind: "ConfigurationError",
        message: `No files found matching pattern: ${inputPattern}`,
      }));
    }

    // Stage 2: Process each file to extract frontmatter
    const documents: MarkdownDocument[] = [];
    const extractedData: FrontmatterData[] = [];

    for (const filePath of filesResult.data) {
      const extractionResult = await this.extractFromSingleFile(
        filePath,
        schema,
      );
      if (extractionResult.ok) {
        documents.push(extractionResult.data.document);
        extractedData.push(extractionResult.data.frontmatterData);
      } else {
        // Log error but continue with other files
        console.warn(
          `Failed to extract frontmatter from ${filePath}: ${extractionResult.error.message}`,
        );
      }
    }

    if (extractedData.length === 0) {
      return err(createError({
        kind: "NO_SUCCESSFUL_RESULTS",
      }, "No valid frontmatter data extracted from any files"));
    }

    // Store results internally - no direct external access
    this.extractedResults = {
      documents,
      extractedData,
    };

    return ok(void 0);
  }

  /**
   * Check if frontmatter data has been extracted
   * This is the only way external services can verify extraction status
   */
  hasExtractedData(): boolean {
    return this.extractedResults !== null &&
      this.extractedResults.extractedData.length > 0;
  }

  /**
   * Get the count of extracted documents
   * For monitoring and validation purposes only
   */
  getExtractedCount(): number {
    return this.extractedResults?.extractedData.length ?? 0;
  }

  /**
   * PRIVATE: Extract frontmatter from a single Markdown file
   * This method handles the low-level extraction logic
   */
  private extractFromSingleFile(
    filePath: string,
    _schema: Schema,
  ): Promise<
    Result<{
      document: MarkdownDocument;
      frontmatterData: FrontmatterData;
    }, DomainError & { message: string }>
  > {
    // Create file path value object
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      return Promise.resolve(filePathResult);
    }

    // Read file content
    const contentResult = this.fileReader.read(filePath);
    if (!contentResult.ok) {
      return Promise.resolve(contentResult);
    }

    // Extract frontmatter (simplified implementation for domain separation)
    const extractResult = this.extractFrontmatterFromContent(
      contentResult.data,
    );
    if (!extractResult.ok) {
      return Promise.resolve(extractResult);
    }

    const { frontmatter, body } = extractResult.data;

    // Create frontmatter data value object
    const frontmatterDataResult = FrontmatterData.create(frontmatter);
    if (!frontmatterDataResult.ok) {
      return Promise.resolve(frontmatterDataResult);
    }

    // Create document entity
    // Use the already created frontmatterDataResult

    const docResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data,
      frontmatterDataResult.data,
      body,
    );
    if (!docResult.ok) {
      return Promise.resolve(docResult);
    }

    return Promise.resolve(ok({
      document: docResult.data,
      frontmatterData: frontmatterDataResult.data,
    }));
  }

  /**
   * PRIVATE: Basic frontmatter extraction logic
   * This is a simplified implementation focusing on domain separation
   */
  private extractFrontmatterFromContent(
    content: string,
  ): Result<{
    frontmatter: Record<string, unknown>;
    body: string;
  }, DomainError & { message: string }> {
    // Basic YAML frontmatter extraction
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return err(createError({
        kind: "ParseError",
        input: content.substring(0, 100),
      }, "No frontmatter found in file"));
    }

    // Extract YAML content and body from the match
    const yamlContent = match[1];
    const body = match[2];

    try {
      // Simple YAML parsing (this would be replaced with proper YAML parser)
      const frontmatter = this.parseSimpleYaml(yamlContent);

      return ok({ frontmatter, body });
    } catch (error) {
      return err(createError(
        {
          kind: "ParseError",
          input: yamlContent,
        },
        `Failed to parse frontmatter: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }

  /**
   * PRIVATE: Simple YAML parser for domain separation demonstration
   * In full implementation, this would use a proper YAML parser
   */
  private parseSimpleYaml(yamlContent: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yamlContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();

          // Simple value parsing
          if (value.startsWith('"') && value.endsWith('"')) {
            result[key] = value.slice(1, -1);
          } else if (value === "true") {
            result[key] = true;
          } else if (value === "false") {
            result[key] = false;
          } else if (!isNaN(Number(value))) {
            result[key] = Number(value);
          } else {
            result[key] = value;
          }
        }
      }
    }

    return result;
  }

  /**
   * PROTECTED: Internal access for Data Processing Instruction Domain only
   * This method should only be called by the Data Processing Instruction Domain
   * Direct external access is prohibited by domain boundaries
   */
  getExtractedDataForProcessing(): Result<
    FrontmatterData[],
    DomainError & { message: string }
  > {
    if (!this.extractedResults) {
      return err(createError({
        kind: "NO_PROCESSING_ACTIVITY",
      }, "No frontmatter data has been extracted yet"));
    }

    // Return a copy to prevent external modification
    return ok([...this.extractedResults.extractedData]);
  }

  /**
   * PROTECTED: Internal access for documents - Data Processing Instruction Domain only
   */
  getDocumentsForProcessing(): Result<
    MarkdownDocument[],
    DomainError & { message: string }
  > {
    if (!this.extractedResults) {
      return err(createError({
        kind: "NO_PROCESSING_ACTIVITY",
      }, "No documents have been processed yet"));
    }

    // Return a copy to prevent external modification
    return ok([...this.extractedResults.documents]);
  }
}
