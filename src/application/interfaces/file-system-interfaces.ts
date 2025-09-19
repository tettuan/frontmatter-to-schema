import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";

/**
 * File reading interface for application layer
 * Defines the contract for reading files in a total function manner
 */
export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

/**
 * File listing interface for application layer
 * Defines the contract for listing files matching patterns
 */
export interface FileLister {
  list(pattern: string): Result<string[], DomainError & { message: string }>;
}

/**
 * File writing interface for application layer
 * Defines the contract for writing files in a total function manner
 */
export interface FileWriter {
  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }>;
}
