import { err, ok, Result } from "../../domain/shared/types/result.ts";
import {
  createError,
  FileSystemError,
} from "../../domain/shared/types/errors.ts";
import type { FileLister as FileListerInterface } from "../../application/index.ts";
import { expandGlobSync } from "jsr:@std/fs";

export class DenoFileLister implements FileListerInterface {
  list(
    pattern: string,
  ): Result<string[], FileSystemError & { message: string }> {
    try {
      const files: string[] = [];
      for (const entry of expandGlobSync(pattern, { includeDirs: false })) {
        files.push(entry.path);
      }
      return ok(files);
    } catch (error) {
      return err(createError({
        kind: "ReadFailed",
        path: pattern,
        message: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }
}
