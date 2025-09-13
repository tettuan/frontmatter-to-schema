import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { ProcessCoordinator } from "../coordinators/process-coordinator.ts";

export interface ProcessDocumentsRequest {
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly inputPattern: string;
}

export interface ProcessDocumentsResponse {
  readonly success: boolean;
  readonly processedFiles: number;
  readonly outputPath: string;
}

export class ProcessDocumentsUseCase {
  constructor(private readonly coordinator: ProcessCoordinator) {}

  execute(
    request: ProcessDocumentsRequest,
  ): Result<ProcessDocumentsResponse, DomainError & { message: string }> {
    const result = this.coordinator.processDocuments(
      request.schemaPath,
      request.outputPath,
      request.inputPattern,
    );

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      data: {
        success: true,
        processedFiles: 0,
        outputPath: request.outputPath,
      },
    };
  }
}
