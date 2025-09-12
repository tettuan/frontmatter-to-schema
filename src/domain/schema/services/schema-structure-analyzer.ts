/**
 * SchemaStructureAnalyzer Domain Service
 *
 * Provides domain service for analyzing JSON schema structures to determine:
 * - Processing strategy (Individual vs ArrayBased)
 * - Array targets with x-frontmatter-part detection
 * - Template paths and derivation rules
 *
 * Applies Totality principles throughout with Result types
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import type { FilePath } from "../../core/file-path.ts";
import { createDomainError } from "../../core/result.ts";
import { SchemaStructure } from "../value-objects/schema-structure.ts";
import type { ArrayTarget } from "../value-objects/array-target.ts";
import { ProcessingMode } from "../../shared/processing-mode.ts";

/**
 * ProcessingStrategy encapsulates the determined processing approach
 */
export interface ProcessingStrategy {
  readonly mode: ProcessingMode;
  readonly schemaStructure: SchemaStructure;
}

/**
 * SchemaStructureAnalyzer domain service for schema analysis
 */
export class SchemaStructureAnalyzer {
  /**
   * Analyzes schema to determine processing strategy
   */
  analyzeForProcessing(
    schema: unknown,
    files: readonly FilePath[],
  ): Result<ProcessingStrategy, DomainError & { message: string }> {
    // First, analyze the schema structure
    const structureResult = SchemaStructure.analyze(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const structure = structureResult.data;

    // Determine processing mode based on structure
    const modeResult = this.determineProcessingMode(structure, files);
    if (!modeResult.ok) {
      return modeResult;
    }

    return {
      ok: true,
      data: {
        mode: modeResult.data,
        schemaStructure: structure,
      },
    };
  }

  /**
   * Identifies array targets with x-frontmatter-part
   */
  identifyArrayTargets(
    schema: unknown,
  ): Result<readonly ArrayTarget[], DomainError & { message: string }> {
    // Analyze schema structure first
    const structureResult = SchemaStructure.analyze(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const structure = structureResult.data;
    const arrayTarget = structure.getArrayTarget();

    return {
      ok: true,
      data: arrayTarget ? [arrayTarget] : [],
    };
  }

  /**
   * Extracts derivation rules from schema
   */
  extractDerivationRules(
    schema: unknown,
  ): Result<
    readonly import("../value-objects/schema-structure.ts").DerivationRule[],
    DomainError & { message: string }
  > {
    // Analyze schema structure first
    const structureResult = SchemaStructure.analyze(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const structure = structureResult.data;

    return {
      ok: true,
      data: structure.getDerivationRules(),
    };
  }

  /**
   * Determines processing mode based on schema structure and files
   */
  private determineProcessingMode(
    structure: SchemaStructure,
    files: readonly FilePath[],
  ): Result<ProcessingMode, DomainError & { message: string }> {
    // Handle empty files list gracefully - still determine the correct mode
    // but with an empty file list (valid scenario for file discovery that finds nothing)
    if (files.length === 0) {
      if (structure.requiresArrayBasedProcessing()) {
        const arrayTarget = structure.getArrayTarget();
        if (!arrayTarget) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidState",
                expected: "array target present",
                actual: "no array target",
              },
              "Schema requires array processing but no array target found",
            ),
          };
        }
        return {
          ok: true,
          data: ProcessingMode.arrayBased(arrayTarget, files),
        };
      } else {
        return {
          ok: true,
          data: ProcessingMode.individual(files),
        };
      }
    }

    // Validate all files are markdown files
    const nonMarkdownFiles = files.filter((file) => !file.isMarkdownFile());
    if (nonMarkdownFiles.length > 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: nonMarkdownFiles.map((f) => f.toString()).join(", "),
            expectedFormat: "markdown files",
          },
          `All files must be markdown files, found non-markdown: ${
            nonMarkdownFiles.map((f) => f.toString()).join(", ")
          }`,
        ),
      };
    }

    // Determine mode based on schema structure
    if (structure.requiresArrayBasedProcessing()) {
      const arrayTarget = structure.getArrayTarget();
      if (!arrayTarget) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidState",
              expected: "array target present",
              actual: "no array target",
            },
            "Schema requires array processing but no array target found",
          ),
        };
      }

      return {
        ok: true,
        data: ProcessingMode.arrayBased(arrayTarget, files),
      };
    } else {
      return {
        ok: true,
        data: ProcessingMode.individual(files),
      };
    }
  }

  /**
   * Validates schema contains required properties for processing
   */
  validateSchemaForProcessing(
    schema: unknown,
  ): Result<void, DomainError & { message: string }> {
    // Validate schema is an object
    if (typeof schema !== "object" || schema === null) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(schema),
            expectedFormat: "object",
          },
          `Schema must be an object for processing, got: ${typeof schema}`,
        ),
      };
    }

    const schemaObj = schema as Record<string, unknown>;

    // Validate schema has properties
    if (!schemaObj.properties || typeof schemaObj.properties !== "object") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: JSON.stringify(schemaObj),
            expectedFormat: "schema with properties",
          },
          "Schema must have a 'properties' object for processing",
        ),
      };
    }

    // Try to analyze structure to catch any structural issues
    const structureResult = SchemaStructure.analyze(schema);
    if (!structureResult.ok) {
      return {
        ok: false,
        error: structureResult.error,
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Checks if schema requires array-based processing
   */
  requiresArrayProcessing(
    schema: unknown,
  ): Result<boolean, DomainError & { message: string }> {
    const structureResult = SchemaStructure.analyze(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    return {
      ok: true,
      data: structureResult.data.requiresArrayBasedProcessing(),
    };
  }

  /**
   * Gets template path from schema if present
   */
  extractTemplatePath(
    schema: unknown,
  ): Result<string | undefined, DomainError & { message: string }> {
    const structureResult = SchemaStructure.analyze(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    return {
      ok: true,
      data: structureResult.data.getTemplatePath(),
    };
  }
}
