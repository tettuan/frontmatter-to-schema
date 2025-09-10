/**
 * File Repository Interface
 * 
 * Infrastructure service for file system operations.
 * Defines contract for document discovery and file operations.
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import type { Document } from "../../domain/models/entities.ts";
import type { InputConfiguration } from "../../application/configuration.ts";

/**
 * Repository interface for file system operations
 * 
 * Belongs to Infrastructure layer - File Context
 */
export interface FileRepository {
  /**
   * Discover documents based on input configuration
   * 
   * @param inputConfig Input configuration specifying patterns and paths
   * @returns Result containing array of discovered documents
   */
  discoverDocuments(
    inputConfig: InputConfiguration,
  ): Promise<Result<Document[], DomainError>>;

  /**
   * Read file content
   * 
   * @param path File path to read
   * @returns Result containing file content
   */
  readFile(path: string): Promise<Result<string, DomainError>>;

  /**
   * Write file content
   * 
   * @param path File path to write
   * @param content Content to write
   * @returns Result indicating success or error
   */
  writeFile(path: string, content: string): Promise<Result<void, DomainError>>;

  /**
   * Check if file exists
   * 
   * @param path File path to check
   * @returns Whether file exists
   */
  exists(path: string): Promise<boolean>;
}