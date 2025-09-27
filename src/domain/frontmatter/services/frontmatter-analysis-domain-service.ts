import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../../schema/entities/schema.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";

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
    // Simple frontmatter parsing
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return null;
    }

    try {
      // Simple YAML-like parsing (very basic)
      const lines = match[1].split("\n");
      const data: Record<string, unknown> = {};

      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value = line.slice(colonIndex + 1).trim();

          // Handle arrays like [item1, item2] or ["item1", "item2"]
          if (value.startsWith("[") && value.endsWith("]")) {
            try {
              // Try to parse as JSON array
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                data[key] = parsed;
                continue;
              }
            } catch {
              // If JSON parsing fails, fall back to string
            }
          }

          // Handle quoted strings
          value = value.replace(/^["']|["']$/g, "");
          data[key] = value;
        }
      }

      return data;
    } catch {
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
