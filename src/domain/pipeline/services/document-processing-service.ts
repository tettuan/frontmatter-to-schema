import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

/**
 * Document Processing Service (Legacy Compatibility)
 *
 * Basic document processing for maintaining compatibility.
 * In the new 3-domain architecture, this is handled by FrontmatterAnalysisDomainService.
 */
export interface DocumentProcessingResult {
  readonly processedData: FrontmatterData[];
  readonly processedCount: number;
  // Legacy compatibility properties
  readonly mainData?: FrontmatterData[];
  readonly itemsData?: FrontmatterData[];
}

export class DocumentProcessingService {
  static create(): Result<
    DocumentProcessingService,
    DomainError & { message: string }
  > {
    return ok(new DocumentProcessingService());
  }

  /**
   * Process documents based on a pattern
   */
  async processDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
  ): Promise<
    Result<DocumentProcessingResult, DomainError & { message: string }>
  > {
    // Convert pattern to file list (basic implementation)
    const filePaths = await this.resolvePattern(inputPattern);
    return this.processFiles(filePaths, validationRules);
  }

  /**
   * Process multiple files
   */
  async processFiles(
    filePaths: string[],
    validationRules: ValidationRules,
  ): Promise<
    Result<DocumentProcessingResult, DomainError & { message: string }>
  > {
    try {
      const processedData: FrontmatterData[] = [];

      // Basic processing for compatibility
      for (const filePath of filePaths) {
        const processResult = await this.processSingleFile(
          filePath,
          validationRules,
        );
        if (processResult.ok) {
          processedData.push(processResult.data);
        }
      }

      return ok({
        processedData,
        processedCount: processedData.length,
      });
    } catch (error) {
      return err(createError(
        {
          kind: "EXCEPTION_CAUGHT",
          originalError: error,
        },
        `Document processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }

  /**
   * Process a single file
   */
  private async processSingleFile(
    filePath: string,
    _validationRules: ValidationRules,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    try {
      // Basic file reading and frontmatter extraction
      const content = await Deno.readTextFile(filePath);

      // Extract frontmatter using basic regex
      const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        return err(createError({
          kind: "ParseError",
          input: content.substring(0, 100),
        }, `No frontmatter found in ${filePath}`));
      }

      // Parse YAML content (basic implementation)
      const yamlContent = match[1];
      const frontmatter = this.parseSimpleYaml(yamlContent);

      return FrontmatterData.create(frontmatter);
    } catch (error) {
      return err(createError(
        {
          kind: "EXCEPTION_CAUGHT",
          originalError: error,
        },
        `Failed to process ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }

  /**
   * Resolve file pattern to list of files
   */
  private async resolvePattern(_pattern: string): Promise<string[]> {
    try {
      // Basic pattern resolution - in production, use glob library
      const files: string[] = [];
      for await (const entry of Deno.readDir(Deno.cwd())) {
        if (entry.isFile && entry.name.endsWith(".md")) {
          files.push(entry.name);
        }
      }
      return files;
    } catch {
      return [];
    }
  }

  /**
   * Simple YAML parser
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
}
