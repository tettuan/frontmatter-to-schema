import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  createError,
  FileSystemError,
} from "../../domain/shared/types/errors.ts";
import type { FileWriter as FileWriterInterface } from "../../application/index.ts";

export class DenoFileWriter implements FileWriterInterface {
  write(
    path: string,
    content: string,
  ): Result<void, FileSystemError & { message: string }> {
    try {
      Deno.writeTextFileSync(path, content);
      return ok(undefined);
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        return err(createError({
          kind: "PermissionDenied",
          path,
        }));
      }

      return err(createError({
        kind: "WriteFailed",
        path,
        message: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }
}
