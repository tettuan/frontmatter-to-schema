import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../../schema/entities/schema.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";
import { parse as parseYaml } from "jsr:@std/yaml";

/**
 * フロントマター解析ドメイン (Frontmatter Analysis Domain)
 *
 * 責務: Markdownファイルからフロントマターデータを抽出する
 */
export type FrontmatterData = Record<string, unknown>;

export interface FrontmatterExtractionResult {
  readonly extractedData: FrontmatterData[];
}

export class FrontmatterAnalysisDomainService {
  private extractedResults: FrontmatterExtractionResult | null = null;

  private constructor(
    private readonly fileReader: DomainFileReader,
    private readonly fileLister: DomainFileLister,
  ) {}

  static create(
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
  ): Result<
    FrontmatterAnalysisDomainService,
    DomainError & { message: string }
  > {
    return ok(new FrontmatterAnalysisDomainService(fileReader, fileLister));
  }

  extractFrontmatterData(
    inputPattern: string,
    _schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    try {
      // List files matching pattern
      const filesResult = this.fileLister.list(inputPattern);
      if (!filesResult.ok) {
        return err(createError({
          kind: "EXCEPTION_CAUGHT",
          message: `Failed to list files: ${filesResult.error.message}`,
        }));
      }

      const extractedData: FrontmatterData[] = [];

      for (const filePath of filesResult.data) {
        const fileResult = this.fileReader.read(filePath);
        if (!fileResult.ok) {
          continue; // Skip files that can't be read
        }

        const frontmatter = this.parseFrontmatter(fileResult.data);
        if (frontmatter) {
          extractedData.push(frontmatter);
        }
      }

      this.extractedResults = { extractedData };
      return ok(void 0);
    } catch (error) {
      return err(createError({
        kind: "EXCEPTION_CAUGHT",
        message: `Frontmatter extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  private parseFrontmatter(content: string): FrontmatterData | null {
    // Extract frontmatter section
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return null;
    }

    try {
      // Use proper YAML parser to handle complex structures
      const parsed = parseYaml(match[1]);

      // Ensure the result is an object (not a primitive or array at root)
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as FrontmatterData;
      }

      // If the parsed result is not a proper object, wrap it
      if (parsed !== null && parsed !== undefined) {
        return { value: parsed } as FrontmatterData;
      }

      return null;
    } catch (error) {
      // Log parsing error for debugging but return null to maintain totality
      console.warn("Failed to parse YAML frontmatter:", error);
      return null;
    }
  }

  hasExtractedData(): boolean {
    return this.extractedResults !== null &&
      this.extractedResults.extractedData.length > 0;
  }

  getExtractedCount(): number {
    return this.extractedResults?.extractedData.length ?? 0;
  }

  /**
   * フロントマター解析結果への保護されたアクセス
   * データ処理指示ドメインのみがアクセス可能
   */
  getExtractedDataForProcessing(): Result<
    FrontmatterData[],
    DomainError & { message: string }
  > {
    if (!this.extractedResults) {
      return err(createError({
        kind: "EXCEPTION_CAUGHT",
        message: "No frontmatter data has been extracted",
      }));
    }

    return ok(this.extractedResults.extractedData);
  }
}
