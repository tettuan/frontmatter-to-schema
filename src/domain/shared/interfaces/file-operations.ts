import { Result } from "../types/result.ts";
import { DomainError } from "../types/errors.ts";

/**
 * Domain-level file reading interface
 * Following DDD principles - Domain abstracts its own contracts
 * Following Totality principles - all operations return Result<T,E>
 */
export interface DomainFileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

/**
 * Domain-level file listing interface
 * Following DDD principles - Domain defines its own file listing contract
 * Following Totality principles - total function returning Result<T,E>
 */
export interface DomainFileLister {
  list(pattern: string): Result<string[], DomainError & { message: string }>;
}

/**
 * Domain-level file writing interface
 * Following DDD principles - Domain abstracts its writing needs
 * Following Totality principles - no exceptions, only Results
 */
export interface DomainFileWriter {
  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }>;
}

/**
 * Combined domain file operations interface
 * Aggregates all file system operations needed by the domain
 */
export interface DomainFileOperations {
  readonly reader: DomainFileReader;
  readonly lister: DomainFileLister;
  readonly writer: DomainFileWriter;
}
