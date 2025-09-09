/**
 * ExecutablePipeline service
 * Extracted from schema-management.ts for better domain separation
 * Handles pipeline execution orchestration with injected schema
 * FIXED: Eliminated type assertions using proper type guards
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import type { ActiveSchema } from "../core/schema-injection.ts";
import type {
  ExecutionConfiguration,
  PipelineOutput,
  SchemaProcessor,
} from "../types/pipeline-types.ts";

/**
 * Type guard to check if value is a record object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Executable Pipeline - One-time use pipeline with injected schema
 */
export class ExecutablePipeline {
  private executed = false;

  constructor(
    readonly id: string,
    readonly config: ExecutionConfiguration,
    private readonly activeSchema: ActiveSchema,
    private readonly processors: Map<string, SchemaProcessor>,
  ) {}

  /**
   * Execute the pipeline once
   */
  async execute(): Promise<
    Result<PipelineOutput, DomainError & { message: string }>
  > {
    if (this.executed) {
      return {
        ok: false,
        error: createDomainError({
          kind: "AlreadyExecuted",
          pipeline: this.id,
        }),
      };
    }

    if (this.activeSchema.kind !== "Loaded") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidState",
          expected: "Loaded",
          actual: this.activeSchema.kind,
        }),
      };
    }

    this.executed = true;

    // Get appropriate processor for this schema
    const processor = this.processors.get("default") ||
      this.processors.values().next().value;
    if (!processor) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "processor",
        }),
      };
    }

    // Process with injected schema
    const result = await processor.process(
      this.config.inputPath,
      this.activeSchema.schemaContext,
      this.activeSchema.templateContext,
      this.activeSchema.promptContext,
    );

    if (!result.ok) {
      return result;
    }

    // Write output
    if (this.config.fileSystem) {
      await this.config.fileSystem.writeFile(
        this.config.outputPath,
        this.formatOutput(result.data, this.config.outputFormat),
      );
    }

    return {
      ok: true,
      data: {
        id: this.id,
        output: result.data,
        outputPath: this.config.outputPath,
        format: this.config.outputFormat,
        executedAt: new Date(),
      },
    };
  }

  /**
   * Dispose of the pipeline
   */
  dispose(): void {
    this.executed = true;
    // Clean up resources if needed
  }

  private formatOutput(data: unknown, format: "json" | "yaml" | "xml"): string {
    switch (format) {
      case "json":
        return JSON.stringify(data, null, 2);
      case "yaml":
        // Simple YAML formatting - would use proper library
        return this.toYAML(data);
      case "xml":
        // Simple XML formatting - would use proper library
        return this.toXML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private toYAML(data: unknown): string {
    // Simplified YAML generation
    if (typeof data !== "object" || data === null) {
      return String(data);
    }

    // FIXED: Replace type assertion with type guard
    if (!isRecord(data)) {
      return String(data);
    }

    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (isRecord(value)) {
        lines.push(`${key}:`);
        for (const [k, v] of Object.entries(value)) {
          lines.push(`  ${k}: ${JSON.stringify(v)}`);
        }
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    return lines.join("\n");
  }

  private toXML(data: unknown): string {
    // Simplified XML generation
    return `<?xml version="1.0" encoding="UTF-8"?>\n<root>${
      this.objectToXML(data)
    }</root>`;
  }

  private objectToXML(data: unknown, indent = 1): string {
    if (typeof data !== "object" || data === null) {
      return String(data);
    }

    // FIXED: Replace type assertion with type guard
    if (!isRecord(data)) {
      return String(data);
    }

    const spaces = "  ".repeat(indent);
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (isRecord(value)) {
        lines.push(`${spaces}<${key}>`);
        lines.push(this.objectToXML(value, indent + 1));
        lines.push(`${spaces}</${key}>`);
      } else {
        lines.push(`${spaces}<${key}>${value}</${key}>`);
      }
    }

    return lines.join("\n");
  }
}
