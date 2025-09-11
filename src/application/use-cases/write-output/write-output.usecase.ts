/**
 * Write Output Use Case
 *
 * Responsible for formatting and writing output to file
 * Part of the File Management Context in DDD
 * Follows Totality principles with Result types
 */

import type { VoidUseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { DRY_RUN_PREVIEW_LENGTH_VALUE } from "../../../domain/shared/constants.ts";
import { createDomainError } from "../../../domain/core/result.ts";
import * as path from "jsr:@std/path@1.0.9";
import * as yaml from "jsr:@std/yaml@1.0.9";
import * as toml from "jsr:@std/toml@1.0.1";

/**
 * Input for writing output
 */
export interface WriteOutputInput {
  data: unknown;
  outputPath: string;
  format: "json" | "yaml" | "toml";
  dryRun?: boolean;
}

/**
 * Write Output Use Case Implementation
 * Handles formatting and writing output in various formats
 */
export class WriteOutputUseCase implements VoidUseCase<WriteOutputInput> {
  async execute(
    input: WriteOutputInput,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      let content: string;

      // Format the data based on output format
      switch (input.format) {
        case "json":
          content = JSON.stringify(input.data, null, 2);
          break;
        case "yaml":
          content = yaml.stringify(input.data);
          break;
        case "toml":
          if (
            !input.data || typeof input.data !== "object" ||
            Array.isArray(input.data)
          ) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: typeof input.data,
                  expectedFormat: "object",
                },
                "TOML format requires an object as input",
              ),
            };
          }
          content = toml.stringify(input.data as Record<string, unknown>);
          break;
        default:
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "UnsupportedAnalysisType",
                type: input.format,
              },
              `Unsupported output format: ${input.format}`,
            ),
          };
      }

      // Skip actual writing in dry-run mode
      if (input.dryRun) {
        console.log(`[DRY-RUN] Would write to: ${input.outputPath}`);
        console.log(
          `[DRY-RUN] Content preview (first ${DRY_RUN_PREVIEW_LENGTH_VALUE.getValue()} chars):`,
        );
        console.log(
          content.substring(0, DRY_RUN_PREVIEW_LENGTH_VALUE.getValue()),
        );
        return { ok: true, data: undefined };
      }

      // Ensure directory exists
      const dir = path.dirname(input.outputPath);
      if (dir && dir !== ".") {
        try {
          await Deno.mkdir(dir, { recursive: true });
        } catch (error) {
          if (!(error instanceof Deno.errors.AlreadyExists)) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "DirectoryNotFound",
                  path: dir,
                },
                `Failed to create directory: ${dir}`,
              ),
            };
          }
        }
      }

      // Write the file
      try {
        await Deno.writeTextFile(input.outputPath, content);
      } catch (error) {
        if (error instanceof Deno.errors.PermissionDenied) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "PermissionDenied",
                path: input.outputPath,
                operation: "write",
              },
              `Permission denied writing to: ${input.outputPath}`,
            ),
          };
        }
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "WriteError",
              path: input.outputPath,
              details: error instanceof Error ? error.message : String(error),
            },
            `Failed to write output: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        };
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "WriteOutput",
            error: {
              kind: "InvalidResponse",
              service: "file-writer",
              response: error instanceof Error ? error.message : String(error),
            },
          },
          `Failed to write output: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }
}
