import type { Result } from "../../domain/shared/result.ts";
import { createIOError, type IOError } from "../../domain/shared/errors.ts";
import type { FileInfo, FileSystemPort } from "../ports/file-system.ts";
import { walk } from "jsr:@std/fs/walk";
import { ensureDir } from "jsr:@std/fs/ensure-dir";

export class DenoFileSystemAdapter implements FileSystemPort {
  async readFile(path: string): Promise<Result<string, IOError>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (error) {
      return {
        ok: false,
        error: createIOError(
          `Failed to read file: ${error}`,
          path,
          "read",
        ),
      };
    }
  }

  async writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, IOError>> {
    try {
      // Ensure directory exists
      const dir = path.substring(0, path.lastIndexOf("/"));
      if (dir) {
        await ensureDir(dir);
      }

      await Deno.writeTextFile(path, content);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createIOError(
          `Failed to write file: ${error}`,
          path,
          "write",
        ),
      };
    }
  }

  async exists(path: string): Promise<Result<boolean, IOError>> {
    try {
      await Deno.stat(path);
      return { ok: true, data: true };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, data: false };
      }
      return {
        ok: false,
        error: createIOError(
          `Failed to check file existence: ${error}`,
          path,
          "read",
        ),
      };
    }
  }

  async listFiles(
    path: string,
    pattern?: string,
  ): Promise<Result<FileInfo[], IOError>> {
    try {
      const files: FileInfo[] = [];
      const regex = pattern ? new RegExp(pattern) : undefined;

      for await (
        const entry of walk(path, {
          includeDirs: false,
          match: regex ? [regex] : undefined,
        })
      ) {
        const stat = await Deno.stat(entry.path);
        files.push({
          path: entry.path,
          name: entry.name,
          isDirectory: entry.isDirectory,
          size: stat.size,
          modifiedAt: stat.mtime || new Date(),
        });
      }

      return { ok: true, data: files };
    } catch (error) {
      return {
        ok: false,
        error: createIOError(
          `Failed to list files: ${error}`,
          path,
          "read",
        ),
      };
    }
  }

  async createDirectory(path: string): Promise<Result<void, IOError>> {
    try {
      await ensureDir(path);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createIOError(
          `Failed to create directory: ${error}`,
          path,
          "write",
        ),
      };
    }
  }

  async deleteFile(path: string): Promise<Result<void, IOError>> {
    try {
      await Deno.remove(path);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createIOError(
          `Failed to delete file: ${error}`,
          path,
          "delete",
        ),
      };
    }
  }
}
