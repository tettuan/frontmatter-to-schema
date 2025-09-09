/**
 * Process Documents Use Case (refactored)
 *
 * This file has been refactored following DDD principles:
 * - Extracted value objects for input validation and output representation
 * - Decomposed monolithic use case into focused services (562 lines → facade pattern)
 * - Proper domain service separation with single responsibility principle
 * - Orchestrator service coordinates the complete workflow
 *
 * NOTE: Maintained functional compatibility while improving architectural design
 * The refactoring follows DDD bounded context separation and service composition
 */

import type { Result } from "../domain/core/result.ts";
import type { FileSystemRepository } from "../domain/repositories/file-system-repository.ts";
import {
  ProcessDocumentsInput as ProcessDocumentsInputVO,
} from "./value-objects/process-documents-input.value-object.ts";
import {
  ProcessDocumentsOptions as ProcessDocumentsOptionsVO,
} from "./value-objects/process-documents-options.value-object.ts";
import { ProcessDocumentsOrchestratorService } from "./services/process-documents-orchestrator.service.ts";

/**
 * Use case input parameters (backward compatibility interface)
 * @deprecated Use ProcessDocumentsInput value object from value-objects/process-documents-input.value-object.ts
 */
export interface ProcessDocumentsInput {
  schemaPath: string;
  outputPath: string;
  inputPattern: string;
  outputFormat: "json" | "yaml" | "toml";
}

/**
 * Use case output result (backward compatibility interface)
 * @deprecated Use ProcessDocumentsOutput value object from value-objects/process-documents-output.value-object.ts
 */
export interface ProcessDocumentsOutput {
  processedCount: number;
  outputPath: string;
  warnings?: string[];
}

/**
 * Use case configuration options (backward compatibility interface)
 * @deprecated Use ProcessDocumentsOptions value object from value-objects/process-documents-options.value-object.ts
 */
export interface ProcessDocumentsOptions {
  verbose?: boolean;
  dryRun?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
}

/**
 * Process Documents Use Case (facade pattern for backward compatibility)
 * @deprecated Use ProcessDocumentsOrchestratorService directly for better separation of concerns
 */
export class ProcessDocumentsUseCase {
  private readonly orchestrator: ProcessDocumentsOrchestratorService;

  constructor(
    private readonly fileSystem: FileSystemRepository,
    private readonly options: ProcessDocumentsOptions = {},
  ) {
    // Convert legacy options to value object
    const optionsResult = ProcessDocumentsOptionsVO.create(options);
    if (!optionsResult.ok) {
      throw new Error(`Invalid options: ${optionsResult.error.message}`);
    }

    this.orchestrator = new ProcessDocumentsOrchestratorService(
      fileSystem,
      optionsResult.data,
    );
  }

  /**
   * Execute the use case (delegates to orchestrator service)
   */
  async execute(
    input: ProcessDocumentsInput,
  ): Promise<
    Result<
      ProcessDocumentsOutput,
      { kind: string; message: string; details?: unknown }
    >
  > {
    // Convert legacy input to value object
    const inputResult = ProcessDocumentsInputVO.create(input);
    if (!inputResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InputValidationError",
          message: `Invalid input: ${inputResult.error.message}`,
        },
      };
    }

    // Delegate to orchestrator
    const result = await this.orchestrator.execute(inputResult.data);
    if (!result.ok) {
      return result;
    }

    // Convert value object back to legacy interface for backward compatibility
    return {
      ok: true,
      data: result.data.toObject() as ProcessDocumentsOutput,
    };
  }
}
