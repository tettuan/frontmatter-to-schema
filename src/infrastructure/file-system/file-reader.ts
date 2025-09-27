import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  createError,
  FileSystemError,
} from "../../domain/shared/types/errors.ts";
interface FileReaderInterface {
  read(path: string): Result<string, FileSystemError & { message: string }>;
}

export class DenoFileReader implements FileReaderInterface {
  read(path: string): Result<string, FileSystemError & { message: string }> {
    try {
      const content = Deno.readTextFileSync(path);
      return ok(content);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return err(createError({
          kind: "FileNotFound",
          path,
        }));
      }

      if (error instanceof Deno.errors.PermissionDenied) {
        return err(createError({
          kind: "PermissionDenied",
          path,
        }));
      }

      return err(createError({
        kind: "ReadFailed",
        path,
        message: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }
}
