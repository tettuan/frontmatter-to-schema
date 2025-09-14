import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { IdListGenerator, IdListResult } from "../../domain/command/index.ts";
import { FrontmatterProcessor } from "../../domain/frontmatter/index.ts";
import { FilePath } from "../../domain/frontmatter/value-objects/file-path.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";

export interface GenerateIdListRequest {
  readonly sourceDirectory: string;
  readonly outputPath?: string;
  readonly outputFormat?: "json" | "text";
}

export interface GenerateIdListResponse {
  readonly result: IdListResult;
  readonly outputPath: string;
  readonly format: "json" | "text";
}

export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

export interface FileWriter {
  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }>;
}

export interface FileLister {
  list(pattern: string): Result<string[], DomainError & { message: string }>;
}

/**
 * Use case for generating command ID lists from frontmatter files
 */
export class GenerateIdListUseCase {
  constructor(
    private readonly frontmatterProcessor: FrontmatterProcessor,
    private readonly idListGenerator: IdListGenerator,
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
    private readonly fileLister: FileLister,
  ) {}

  execute(
    request: GenerateIdListRequest,
  ): Result<GenerateIdListResponse, DomainError & { message: string }> {
    const { sourceDirectory, outputPath, outputFormat = "json" } = request;

    // List all markdown files in the source directory (including subdirectories)
    const pattern = `${sourceDirectory}/**/*.md`;
    const filesResult = this.fileLister.list(pattern);
    if (!filesResult.ok) {
      return filesResult;
    }

    if (filesResult.data.length === 0) {
      return err(createError({
        kind: "FileNotFound",
        path: pattern,
      }, `No markdown files found in directory: ${sourceDirectory}`));
    }

    // Process each file
    const frontmatterList: FrontmatterData[] = [];

    for (const filePath of filesResult.data) {
      const filePathResult = FilePath.create(filePath);
      if (!filePathResult.ok) {
        continue; // Skip invalid paths
      }

      const contentResult = this.fileReader.read(filePath);
      if (!contentResult.ok) {
        continue; // Skip files that can't be read
      }

      const extractResult = this.frontmatterProcessor.extract(
        contentResult.data,
      );
      if (!extractResult.ok) {
        continue; // Skip files without valid frontmatter
      }

      frontmatterList.push(extractResult.data.frontmatter);
    }

    // Generate ID list
    const idListResult = this.idListGenerator.generate(
      frontmatterList,
      sourceDirectory,
    );
    if (!idListResult.ok) {
      return idListResult;
    }

    // Determine output path
    const finalOutputPath = outputPath ||
      `${sourceDirectory}/id-list.${outputFormat}`;

    // Format and write output
    const writeResult = this.writeOutput(
      idListResult.data,
      finalOutputPath,
      outputFormat,
    );
    if (!writeResult.ok) {
      return writeResult;
    }

    return ok({
      result: idListResult.data,
      outputPath: finalOutputPath,
      format: outputFormat,
    });
  }

  private writeOutput(
    result: IdListResult,
    outputPath: string,
    format: "json" | "text",
  ): Result<void, DomainError & { message: string }> {
    let content: string;

    if (format === "json") {
      content = JSON.stringify(result, null, 2);
    } else {
      content = result.id_list.join("\n");
    }

    return this.fileWriter.write(outputPath, content);
  }
}
