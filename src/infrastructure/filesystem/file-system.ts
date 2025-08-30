import type { Registry } from "../../domain/core/types.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { PromptFile, PromptList } from "../../domain/services/prompt-models.ts";
import { walk } from "jsr:@std/fs@1/walk";

export class FileReader {
  async readDirectory(
    path: string,
  ): Promise<Result<PromptList, DomainError & { message: string }>> {
    try {
      const list = new PromptList();

      for await (
        const entry of walk(path, {
          exts: [".md"],
          includeDirs: false,
        })
      ) {
        const contentResult = await this.readFile(entry.path);
        if (!contentResult.ok) {
          return contentResult;
        }
        const promptFile = new PromptFile(entry.path, contentResult.data);
        list.add(promptFile);
      }

      return { ok: true, data: list };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "FileNotFound",
              path: path,
            },
            `Directory not found: ${path}`,
          ),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "PermissionDenied",
              path: path,
              operation: "read",
            },
            `Permission denied to read directory: ${path}`,
          ),
        };
      }
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ReadError",
            path: path,
            details: String(error),
          },
          `Failed to read directory ${path}: ${error}`,
        ),
      };
    }
  }

  async readFile(
    path: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "FileNotFound",
              path: path,
            },
            `File not found: ${path}`,
          ),
        };
      }
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "PermissionDenied",
              path: path,
              operation: "read",
            },
            `Permission denied to read file: ${path}`,
          ),
        };
      }
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ReadError",
            path: path,
            details: String(error),
          },
          `Failed to read file ${path}: ${error}`,
        ),
      };
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

export class FileWriter {
  async writeJson(path: string, data: Registry): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await Deno.writeTextFile(path, json);
  }

  async ensureDir(path: string): Promise<void> {
    await Deno.mkdir(path, { recursive: true });
  }
}
