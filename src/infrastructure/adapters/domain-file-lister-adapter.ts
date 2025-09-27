import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { DomainFileLister } from "../../domain/shared/interfaces/file-operations.ts";
import { DenoFileLister } from "../file-system/file-lister.ts";

/**
 * Adapter to convert DenoFileLister (infrastructure) to DomainFileLister (domain)
 * Converts FileSystemError to DomainError
 */
export class DomainFileListerAdapter implements DomainFileLister {
  constructor(private readonly denoFileLister: DenoFileLister) {}

  list(pattern: string): Result<string[], DomainError & { message: string }> {
    const result = this.denoFileLister.list(pattern);

    if (!result.ok) {
      // Convert FileSystemError to DomainError
      return err(createError({
        kind: result.error.kind as any, // FileSystemError kind should be compatible
        message: result.error.message,
      }));
    }

    return ok(result.data);
  }

  static create(denoFileLister: DenoFileLister): DomainFileListerAdapter {
    return new DomainFileListerAdapter(denoFileLister);
  }
}
