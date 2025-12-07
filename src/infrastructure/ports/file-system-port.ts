import { Result } from "../../domain/shared/types/result.ts";
import {
  DirectoryEntry,
  FileError,
  FileInfo,
} from "../../domain/shared/types/file-errors.ts";

/**
 * Port interface for file system operations.
 * Follows totality principles - all operations return Result<T, E>.
 */
export interface FileSystemPort {
  /**
   * Reads text content from a file.
   */
  readTextFile(path: string): Promise<Result<string, FileError>>;

  /**
   * Writes text content to a file.
   */
  writeTextFile(
    path: string,
    content: string,
  ): Promise<Result<void, FileError>>;

  /**
   * Gets file or directory information.
   */
  stat(path: string): Promise<Result<FileInfo, FileError>>;

  /**
   * Checks if a file or directory exists.
   */
  exists(path: string): Promise<Result<boolean, FileError>>;

  /**
   * Reads directory entries.
   */
  readDir(path: string): Promise<Result<DirectoryEntry[], FileError>>;

  /**
   * Expands a glob pattern and returns matching file paths.
   * Optional method - adapters can implement this for optimized glob expansion.
   * If not implemented, the orchestrator will use walkDirectory + pattern matching.
   *
   * @param pattern - Glob pattern to expand (e.g., "docs/*.md", "**\/*.ts")
   * @param root - Root directory to start from (defaults to current working directory)
   * @returns Array of absolute file paths matching the pattern
   */
  expandGlob?(
    pattern: string,
    root?: string,
  ): Promise<Result<string[], FileError>>;

  /**
   * Gets the current working directory.
   * Optional method - used as default root for glob expansion.
   * If not implemented, the orchestrator will require explicit root paths.
   */
  cwd?(): string;
}
