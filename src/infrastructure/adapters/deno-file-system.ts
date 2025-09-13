/**
 * Deno File System Implementation
 * Provides basic file system operations for TemplateOutputService
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import type { FileSystemPort } from "../ports/index.ts";
import { createDomainError } from "../../domain/core/result.ts";

export class DenoFileSystem implements FileSystemPort {
  async readFile(path: string): Promise<Result<string, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "ReadError", path },
          `Failed to read file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
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
      return {
        ok: false,
        error: createDomainError(
          { kind: "WriteError", path },
          `Failed to write file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  async exists(path: string): Promise<Result<boolean, DomainError>> {
    try {
      await Deno.stat(path);
      return { ok: true, data: true };
    } catch {
      return { ok: true, data: false };
    }
  }

  listFiles(): Promise<Result<never[], DomainError>> {
    // Not needed for TemplateOutputService, return empty array
    return Promise.resolve({ ok: true, data: [] });
  }

  createDirectory(): Promise<Result<void, DomainError>> {
    // Not needed for TemplateOutputService
    return Promise.resolve({ ok: true, data: undefined });
  }

  deleteFile(): Promise<Result<void, DomainError>> {
    // Not needed for TemplateOutputService
    return Promise.resolve({ ok: true, data: undefined });
  }
}
