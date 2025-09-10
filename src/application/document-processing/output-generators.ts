/**
 * Output Generators - File Output and Format Generation Services
 * Following DDD principles and domain boundary separation
 * Part of Application Layer - Document Processing Context
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import type { Template } from "../../domain/models/domain-models.ts";
import type { BatchTransformationResult } from "../../domain/models/transformation.ts";
import type { FileSystemPort } from "../../infrastructure/ports/index.ts";
import type { OutputFormat } from "../configuration.ts";
import type { TransformationPipeline } from "./transformation-pipeline.ts";

/**
 * Output generation service following File Context boundaries
 */
export class OutputGenerator {
  constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly transformationPipeline: TransformationPipeline,
  ) {}

  /**
   * Generate output file from batch results
   * Follows Smart Constructor pattern with Result types
   */
  async generateOutput(
    batchResult: BatchTransformationResult,
    template: Template,
    config: { path: string; format: OutputFormat },
  ): Promise<Result<void, DomainError>> {
    const aggregatedData = batchResult.aggregateData();

    // Apply template mapping following Totality principle
    const templateMappingResult = this.transformationPipeline
      .applyTemplateMapping(
        aggregatedData,
        template,
        config.format.getValue(),
      );

    if (!templateMappingResult.ok) {
      return templateMappingResult;
    }

    const outputString = templateMappingResult.data;

    const writeResult = await this.fileSystem.writeFile(
      config.path,
      outputString,
    );

    return writeResult;
  }
}

/**
 * Format conversion utilities
 * Separated for potential reuse and clear responsibility
 */
export class FormatConverters {
  /**
   * Convert data to YAML format
   */
  static convertToYaml(data: unknown, indent: number = 0): string {
    const indentStr = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return "null";
    }

    if (typeof data === "string") {
      return `"${data.replace(/"/g, '\\"')}"`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "[]";
      }
      return data
        .map((item) =>
          `${indentStr}- ${FormatConverters.convertToYaml(item, indent + 1)}`
        )
        .join("\n");
    }

    if (typeof data === "object") {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return "{}";
      }
      return entries
        .map(([key, value]) =>
          `${indentStr}${key}: ${
            FormatConverters.convertToYaml(value, indent + 1)
          }`
        )
        .join("\n");
    }

    return String(data);
  }

  /**
   * Convert data to XML format
   */
  static convertToXml(data: unknown): string {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return `<root>${String(data)}</root>`;
    }

    const entries = Object.entries(data);
    const xmlContent = entries.map(([key, value]) => {
      if (
        typeof value === "object" && value !== null && !Array.isArray(value)
      ) {
        return `<${key}>${
          FormatConverters.convertToXml(value).replace(/<\/?root>/g, "")
        }</${key}>`;
      }
      return `<${key}>${String(value)}</${key}>`;
    }).join("");

    return `<root>${xmlContent}</root>`;
  }

  /**
   * Convert data to JSON format with pretty printing
   */
  static convertToJson(data: unknown, indent: number = 2): string {
    return JSON.stringify(data, null, indent);
  }

  /**
   * Convert data to markdown format
   */
  static convertToMarkdown(data: unknown): string {
    if (typeof data !== "object" || data === null) {
      return String(data);
    }

    if (Array.isArray(data)) {
      return data.map((item, index) =>
        `${index + 1}. ${FormatConverters.convertToMarkdown(item)}`
      ).join("\n");
    }

    const entries = Object.entries(data);
    return entries.map(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        return `## ${key}\n\n${FormatConverters.convertToMarkdown(value)}\n`;
      }
      return `**${key}**: ${String(value)}\n`;
    }).join("\n");
  }
}
