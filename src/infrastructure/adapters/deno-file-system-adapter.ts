import { Result } from "../../domain/shared/types/result.ts";
import {
  DirectoryEntry,
  FileError,
  FileInfo,
} from "../../domain/shared/types/file-errors.ts";
import { FileSystemPort } from "../ports/file-system-port.ts";

/**
 * Deno implementation of FileSystemPort.
 * Converts Deno exceptions to Result types following totality principles.
 */
export class DenoFileSystemAdapter implements FileSystemPort {
  /**
   * Creates a new Deno file system adapter.
   */
  static create(): DenoFileSystemAdapter {
    return new DenoFileSystemAdapter();
  }

  private constructor() {}

  async readTextFile(path: string): Promise<Result<string, FileError>> {
    try {
      const content = await Deno.readTextFile(path);
      return Result.ok(content);
    } catch (error) {
      return Result.error(this.mapDenoError(error, path, "read"));
    }
  }

  async writeTextFile(
    path: string,
    content: string,
  ): Promise<Result<void, FileError>> {
    try {
      await Deno.writeTextFile(path, content);
      return Result.ok(undefined);
    } catch (error) {
      return Result.error(this.mapDenoError(error, path, "write"));
    }
  }

  async stat(path: string): Promise<Result<FileInfo, FileError>> {
    try {
      const fileInfo = await Deno.stat(path);
      return Result.ok({
        isFile: fileInfo.isFile,
        isDirectory: fileInfo.isDirectory,
        size: fileInfo.size,
        mtime: fileInfo.mtime,
      });
    } catch (error) {
      return Result.error(this.mapDenoError(error, path, "read"));
    }
  }

  async exists(path: string): Promise<Result<boolean, FileError>> {
    try {
      await Deno.stat(path);
      return Result.ok(true);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return Result.ok(false);
      }
      return Result.error(this.mapDenoError(error, path, "read"));
    }
  }

  async readDir(path: string): Promise<Result<DirectoryEntry[], FileError>> {
    try {
      const entries: DirectoryEntry[] = [];
      for await (const entry of Deno.readDir(path)) {
        entries.push({
          name: entry.name,
          isFile: entry.isFile,
          isDirectory: entry.isDirectory,
        });
      }
      return Result.ok(entries);
    } catch (error) {
      return Result.error(this.mapDenoError(error, path, "read"));
    }
  }

  /**
   * Maps Deno errors to standardized FileError types.
   */
  private mapDenoError(
    error: unknown,
    path: string,
    operation: "read" | "write",
  ): FileError {
    if (error instanceof Deno.errors.NotFound) {
      return { kind: "FileNotFound", path };
    }

    if (error instanceof Deno.errors.PermissionDenied) {
      return { kind: "PermissionDenied", path, operation };
    }

    if (error instanceof Deno.errors.AlreadyExists) {
      return { kind: "FileAlreadyExists", path };
    }

    // Generic I/O error for other cases
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "IOError", path, message };
  }
}
