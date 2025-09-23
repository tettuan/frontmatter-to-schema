import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
  ProcessingBoundsMonitor,
} from "../../shared/types/processing-bounds.ts";
import type { DomainFileLister } from "../../shared/interfaces/file-operations.ts";

/**
 * File Discovery Service - Domain Service for DDD Phase 2
 *
 * Handles file discovery and processing bounds initialization following DDD principles.
 * Extracted from Stage 2 of the monolithic pipeline to reduce complexity and improve maintainability.
 *
 * Single Responsibility: File pattern matching and processing bounds setup
 * Follows Totality principles with Result<T,E> pattern and smart constructor
 */

/**
 * Configuration for File Discovery Service following dependency injection pattern
 */
export interface FileDiscoveryServiceConfig {
  readonly fileLister: DomainFileLister;
}

/**
 * Options for file discovery operation
 */
export interface FileDiscoveryOptions {
  readonly processingBounds?: ProcessingBounds;
  readonly pattern: string;
}

/**
 * Result type for file discovery operation
 */
export interface FileDiscoveryResult {
  readonly files: string[];
  readonly boundsMonitor: ProcessingBoundsMonitor;
  readonly fileCount: number;
  readonly boundsType: string;
}

/**
 * Error types specific to file discovery
 */
export type FileDiscoveryError =
  | { kind: "ConfigurationError"; service: string }
  | { kind: "FileListingError"; pattern: string; originalError: DomainError }
  | {
    kind: "BoundsCreationError";
    fileCount: number;
    originalError: DomainError;
  };

/**
 * File Discovery Service implementing Stage 2 logic from DDD architecture
 *
 * Responsibilities:
 * - Discover files matching the specified pattern
 * - Initialize processing bounds monitoring for memory management
 * - Setup bounds monitor for downstream processing stages
 * - Provide structured error handling with Result<T,E> pattern
 * - Log discovery decisions for debugging and monitoring
 */
export class FileDiscoveryService {
  private constructor(private readonly config: FileDiscoveryServiceConfig) {}

  /**
   * Smart Constructor following Totality principles
   * Validates configuration and ensures all required dependencies are present
   */
  static create(
    config: FileDiscoveryServiceConfig,
  ): Result<FileDiscoveryService, DomainError & { message: string }> {
    // Validate required dependencies
    if (!config?.fileLister) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "DomainFileLister is required for file discovery operations",
        }),
      };
    }

    return ok(new FileDiscoveryService(config));
  }

  /**
   * Discover files and initialize processing bounds
   * Implements Stage 2 logic: file listing and bounds monitoring setup
   */
  discoverFiles(
    options: FileDiscoveryOptions,
    logger?: DebugLogger,
  ): Result<FileDiscoveryResult, DomainError & { message: string }> {
    logger?.debug("Starting file discovery", {
      operation: "file-discovery",
      pattern: options.pattern,
      hasBounds: !!options.processingBounds,
      timestamp: new Date().toISOString(),
    });

    // List matching files
    const filesResult = this.config.fileLister.list(options.pattern);
    if (!filesResult.ok) {
      logger?.error(
        `Failed to list files with pattern: ${options.pattern}`,
        {
          operation: "file-listing",
          pattern: options.pattern,
          error: filesResult.error,
          timestamp: new Date().toISOString(),
        },
      );
      return filesResult;
    }

    const files = filesResult.data;
    const fileCount = files.length;

    logger?.info(
      `Found ${fileCount} files to process`,
      {
        operation: "file-listing",
        count: fileCount,
        files: files,
        timestamp: new Date().toISOString(),
      },
    );

    // Initialize memory bounds monitoring
    let actualBounds: ProcessingBounds;
    if (options.processingBounds) {
      actualBounds = options.processingBounds;
    } else {
      const defaultBoundsResult = ProcessingBoundsFactory.createDefault(
        fileCount,
      );
      if (!defaultBoundsResult.ok) {
        logger?.error(
          `Failed to create processing bounds for ${fileCount} files`,
          {
            operation: "bounds-creation",
            fileCount,
            error: defaultBoundsResult.error,
            timestamp: new Date().toISOString(),
          },
        );
        return defaultBoundsResult;
      }
      actualBounds = defaultBoundsResult.data;
    }

    const boundsMonitor = ProcessingBoundsMonitor.create(actualBounds);

    logger?.debug(
      "Initialized processing bounds",
      {
        operation: "memory-monitoring",
        boundsType: actualBounds.kind,
        fileCount: fileCount,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({
      files,
      boundsMonitor,
      fileCount,
      boundsType: actualBounds.kind,
    });
  }

  /**
   * Get file discovery statistics for monitoring and debugging
   */
  getDiscoveryStats(files: string[]): {
    readonly fileCount: number;
    readonly averagePathLength: number;
    readonly distinctDirectories: number;
  } {
    const fileCount = files.length;
    const averagePathLength =
      files.reduce((sum, path) => sum + path.length, 0) /
      fileCount;
    const directories = new Set(
      files.map((path) => path.split("/").slice(0, -1).join("/")),
    );

    return {
      fileCount,
      averagePathLength: Math.round(averagePathLength),
      distinctDirectories: directories.size,
    };
  }
}
