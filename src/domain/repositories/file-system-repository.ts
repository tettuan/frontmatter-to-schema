/**
 * FileSystemRepository Interface
 *
 * Domain layer abstraction for file system operations.
 * Follows DDD principles by defining the interface in the domain layer
 * while implementation resides in the infrastructure layer.
 */

import type { DomainError, Result } from "../core/result.ts";

/**
 * File information returned by stat operations
 */
export interface FileInfo {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly mtime: Date | null;
}

/**
 * File system operations repository interface
 * Abstracts all file I/O operations from the domain layer
 */
export interface FileSystemRepository {
  /**
   * Read a file's content as text
   * @param path The file path to read
   * @returns Result with file content or error
   */
  readFile(path: string): Promise<Result<string, DomainError>>;

  /**
   * Write text content to a file
   * @param path The file path to write to
   * @param content The content to write
   * @returns Result indicating success or error
   */
  writeFile(path: string, content: string): Promise<Result<void, DomainError>>;

  /**
   * Ensure a directory exists, creating it if necessary
   * @param path The directory path to ensure
   * @returns Result indicating success or error
   */
  ensureDirectory(path: string): Promise<Result<void, DomainError>>;

  /**
   * Check if a file exists
   * @param path The file path to check
   * @returns Result with boolean indicating existence
   */
  exists(path: string): Promise<Result<boolean, DomainError>>;

  /**
   * Find files matching a glob pattern
   * @param pattern The glob pattern to match
   * @returns AsyncIterable of file paths
   */
  findFiles(pattern: string): AsyncIterable<string>;

  /**
   * Get file or directory information
   * @param path The file or directory path to stat
   * @returns Result with file info or error
   */
  stat(path: string): Promise<Result<FileInfo, DomainError>>;
}

/**
 * Environment variables repository interface
 * Abstracts environment variable access from the domain layer
 */
export interface EnvironmentRepository {
  /**
   * Get an environment variable value
   * @param key The environment variable name
   * @returns The value or undefined if not set
   */
  get(key: string): string | undefined;

  /**
   * Get an environment variable with a default value
   * @param key The environment variable name
   * @param defaultValue The default value if not set
   * @returns The value or default
   */
  getOrDefault(key: string, defaultValue: string): string;

  /**
   * Get the current working directory
   * @returns The current working directory path
   */
  getCurrentDirectory(): string;
}
