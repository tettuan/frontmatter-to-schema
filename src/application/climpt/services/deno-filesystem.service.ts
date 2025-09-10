/**
 * Deno File System Service - File System Port Implementation
 *
 * Implements the FileSystemPort interface for Deno filesystem operations.
 * Extracted from climpt-adapter.ts for better organization.
 */

import type {
  FileInfo,
  FileSystemPort,
} from "../../../infrastructure/ports/index.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";

/**
 * Deno file system provider
 */
export class DenoFileSystemProvider implements FileSystemPort {
  async readFile(path: string): Promise<Result<string, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "FileNotFound", path },
      };
    }
  }

  async writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, DomainError>> {
    try {
      // Ensure directory exists
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir) {
        await Deno.mkdir(dir, { recursive: true });
      }

      await Deno.writeTextFile(path, content);
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "write" },
      };
    }
  }

  async listFiles(
    dirPath: string,
    pattern?: string,
  ): Promise<Result<FileInfo[], DomainError>> {
    try {
      const files: FileInfo[] = [];
      const regex = pattern ? new RegExp(pattern) : null;

      for await (const entry of Deno.readDir(dirPath)) {
        if (!regex || regex.test(entry.name)) {
          const fullPath = `${dirPath}/${entry.name}`;
          const stat = await Deno.stat(fullPath);
          files.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory,
            size: stat.size,
            modifiedAt: stat.mtime || new Date(),
          });
        }
      }

      return { ok: true, data: files };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "DirectoryNotFound", path: dirPath },
      };
    }
  }

  async exists(path: string): Promise<Result<boolean, DomainError>> {
    try {
      await Deno.stat(path);
      return { ok: true, data: true };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, data: false };
      }
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "stat" },
      };
    }
  }

  async createDirectory(path: string): Promise<Result<void, DomainError>> {
    try {
      await Deno.mkdir(path, { recursive: true });
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "mkdir" },
      };
    }
  }

  async deleteFile(path: string): Promise<Result<void, DomainError>> {
    try {
      await Deno.remove(path);
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "delete" },
      };
    }
  }

  // Legacy methods for backward compatibility
  async readDirectory(path: string): Promise<string[]> {
    const result = await this.listFiles(path, "\\.md$");
    if (result.ok) {
      return result.data.map((f) => f.name); // Return just the name, not full path
    }
    throw new Error(`Failed to read directory: ${result.error.kind}`);
  }
}
