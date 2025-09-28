import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";
import { MarkdownDocument } from "../../domain/frontmatter/entities/markdown-document.ts";
import { FileSystemPort } from "../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../domain/shared/types/file-errors.ts";

/**
 * Strategy interface for processing different input types.
 * Replaces hardcoded if-statements with configurable strategy patterns.
 */
export interface InputProcessingStrategy {
  readonly strategyType: string;
  canProcess(
    inputPath: string,
    fileSystem: FileSystemPort,
  ): Promise<Result<boolean, ProcessingError>>;
  processInput(
    inputPath: string,
    fileSystem: FileSystemPort,
    documentLoader: DocumentLoader,
  ): Promise<Result<MarkdownDocument[], ProcessingError>>;
}

/**
 * Document loader interface for dependency injection.
 */
export interface DocumentLoader {
  loadMarkdownDocument(
    filePath: string,
  ): Promise<Result<MarkdownDocument, ProcessingError>>;
}

/**
 * Strategy for processing single files.
 */
export class SingleFileStrategy implements InputProcessingStrategy {
  readonly strategyType = "single-file";

  async canProcess(
    inputPath: string,
    fileSystem: FileSystemPort,
  ): Promise<Result<boolean, ProcessingError>> {
    const statResult = await fileSystem.stat(inputPath);
    if (statResult.isError()) {
      return Result.ok(false); // Cannot process if stat fails
    }
    return Result.ok(statResult.unwrap().isFile);
  }

  async processInput(
    inputPath: string,
    _fileSystem: FileSystemPort,
    documentLoader: DocumentLoader,
  ): Promise<Result<MarkdownDocument[], ProcessingError>> {
    const document = await documentLoader.loadMarkdownDocument(inputPath);
    if (document.isError()) {
      return Result.error(document.unwrapError());
    }
    return Result.ok([document.unwrap()]);
  }
}

/**
 * Strategy for processing directories.
 */
export class DirectoryStrategy implements InputProcessingStrategy {
  readonly strategyType = "directory";

  constructor(private readonly documentFilter: DocumentFilter) {}

  async canProcess(
    inputPath: string,
    fileSystem: FileSystemPort,
  ): Promise<Result<boolean, ProcessingError>> {
    const statResult = await fileSystem.stat(inputPath);
    if (statResult.isError()) {
      return Result.ok(false); // Cannot process if stat fails
    }
    return Result.ok(statResult.unwrap().isDirectory);
  }

  async processInput(
    inputPath: string,
    fileSystem: FileSystemPort,
    documentLoader: DocumentLoader,
  ): Promise<Result<MarkdownDocument[], ProcessingError>> {
    const dirResult = await fileSystem.readDir(inputPath);
    if (dirResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Cannot read directory: ${
            createFileError(dirResult.unwrapError()).message
          }`,
          "DIRECTORY_READ_ERROR",
          { inputPath, error: dirResult.unwrapError() },
        ),
      );
    }

    const documents: MarkdownDocument[] = [];
    const entries = dirResult.unwrap();

    for (const entry of entries) {
      const shouldProcess = await this.documentFilter.shouldProcess(
        entry,
        inputPath,
      );
      if (shouldProcess) {
        const filePath = `${inputPath}/${entry.name}`;
        const document = await documentLoader.loadMarkdownDocument(filePath);
        if (document.isOk()) {
          documents.push(document.unwrap());
        }
        // Continue processing other files even if one fails
      }
    }

    if (documents.length === 0) {
      return Result.error(
        new ProcessingError(
          "No valid documents found in directory",
          "NO_DOCUMENTS_FOUND",
          { inputPath },
        ),
      );
    }

    return Result.ok(documents);
  }
}

/**
 * Document filter interface for filtering files in directories.
 */
export interface DocumentFilter {
  shouldProcess(
    entry: { name: string; isFile: boolean },
    basePath: string,
  ): Promise<boolean>;
}

/**
 * Configurable document filter that replaces hardcoded file extension checks.
 */
export class ConfigurableDocumentFilter implements DocumentFilter {
  constructor(
    private readonly allowedExtensions: Set<string>,
    private readonly fileTypesOnly: boolean = true,
  ) {}

  shouldProcess(entry: { name: string; isFile: boolean }): Promise<boolean> {
    if (this.fileTypesOnly && !entry.isFile) {
      return Promise.resolve(false);
    }

    for (const extension of this.allowedExtensions) {
      if (entry.name.endsWith(extension)) {
        return Promise.resolve(true);
      }
    }

    return Promise.resolve(false);
  }

  static createMarkdownFilter(): ConfigurableDocumentFilter {
    return new ConfigurableDocumentFilter(new Set([".md", ".markdown"]));
  }
}

/**
 * Factory for creating input processing strategies.
 */
export class InputProcessingStrategyFactory {
  static createDefaultStrategies(
    documentFilter: DocumentFilter,
  ): InputProcessingStrategy[] {
    return [
      new SingleFileStrategy(),
      new DirectoryStrategy(documentFilter),
    ];
  }

  static selectStrategy(
    strategies: InputProcessingStrategy[],
    inputPath: string,
    fileSystem: FileSystemPort,
  ): Promise<Result<InputProcessingStrategy, ProcessingError>> {
    return this.selectFirstCompatibleStrategy(
      strategies,
      inputPath,
      fileSystem,
    );
  }

  private static async selectFirstCompatibleStrategy(
    strategies: InputProcessingStrategy[],
    inputPath: string,
    fileSystem: FileSystemPort,
  ): Promise<Result<InputProcessingStrategy, ProcessingError>> {
    // First check if input path exists - preserve original error behavior
    const statResult = await fileSystem.stat(inputPath);
    if (statResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Cannot access input path: ${
            createFileError(statResult.unwrapError()).message
          }`,
          "INPUT_ACCESS_ERROR",
          { inputPath, error: statResult.unwrapError() },
        ),
      );
    }

    for (const strategy of strategies) {
      const canProcessResult = await strategy.canProcess(inputPath, fileSystem);
      if (canProcessResult.isOk() && canProcessResult.unwrap()) {
        return Result.ok(strategy);
      }
    }

    return Result.error(
      new ProcessingError(
        "No compatible strategy found for input path",
        "NO_STRATEGY_FOUND",
        {
          inputPath,
          availableStrategies: strategies.map((s) => s.strategyType),
        },
      ),
    );
  }
}
