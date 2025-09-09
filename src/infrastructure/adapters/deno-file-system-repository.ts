/**
 * DenoFileSystemRepository Implementation
 *
 * Infrastructure layer implementation of FileSystemRepository
 * using Deno APIs. This adapter isolates Deno-specific code
 * from the domain layer.
 */

import type {
  EnvironmentRepository,
  FileInfo,
  FileSystemRepository,
} from "../../domain/repositories/file-system-repository.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { expandGlob } from "jsr:@std/fs";

/**
 * Deno-based implementation of FileSystemRepository
 */
export class DenoFileSystemRepository implements FileSystemRepository {
  async readFile(path: string): Promise<Result<string, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path,
          }),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path,
            operation: "read",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, DomainError>> {
    try {
      await Deno.writeTextFile(path, content);
      return { ok: true, data: undefined };
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path,
            operation: "write",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async ensureDirectory(path: string): Promise<Result<void, DomainError>> {
    try {
      await Deno.mkdir(path, { recursive: true });
      return { ok: true, data: undefined };
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path,
            operation: "mkdir",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async exists(path: string): Promise<Result<boolean, DomainError>> {
    try {
      const stat = await Deno.stat(path);
      return { ok: true, data: stat.isFile || stat.isDirectory };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, data: false };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path,
            operation: "stat",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async *findFiles(pattern: string): AsyncIterable<string> {
    try {
      for await (const entry of expandGlob(pattern)) {
        if (entry.isFile) {
          yield entry.path;
        }
      }
    } catch (error) {
      // Log error but continue iteration
      console.error(`Error finding files with pattern ${pattern}:`, error);
    }
  }

  async stat(path: string): Promise<Result<FileInfo, DomainError>> {
    try {
      const stat = await Deno.stat(path);
      return {
        ok: true,
        data: {
          isFile: stat.isFile,
          isDirectory: stat.isDirectory,
          size: stat.size,
          mtime: stat.mtime,
        },
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path,
          }),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path,
            operation: "stat",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}

/**
 * Deno-based implementation of EnvironmentRepository
 */
export class DenoEnvironmentRepository implements EnvironmentRepository {
  get(key: string): string | undefined {
    return Deno.env.get(key);
  }

  getOrDefault(key: string, defaultValue: string): string {
    return Deno.env.get(key) || defaultValue;
  }

  getCurrentDirectory(): string {
    return Deno.cwd();
  }
}
