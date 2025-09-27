import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { DenoFileReader } from "../file-system/file-reader.ts";
import type { DomainFileReader } from "../../domain/shared/interfaces/file-operations.ts";

/**
 * Adapter that bridges DenoFileReader (infrastructure) with DomainFileReader (domain interface)
 * Following Adapter Pattern to convert between infrastructure and domain error types
 */
export class DomainFileReaderAdapter implements DomainFileReader {
  private constructor(private readonly denoFileReader: DenoFileReader) {}

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    denoFileReader: DenoFileReader,
  ): DomainFileReaderAdapter {
    return new DomainFileReaderAdapter(denoFileReader);
  }

  /**
   * Read file and convert infrastructure errors to domain errors
   */
  read(path: string): Result<string, DomainError & { message: string }> {
    const result = this.denoFileReader.read(path);
    if (!result.ok) {
      // Convert FileSystemError to DomainError
      return err(createError({
        kind: result.error.kind as any,
        message: result.error.message,
      }));
    }
    return ok(result.data);
  }
}
