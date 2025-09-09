/**
 * Process Command Use Case
 *
 * Application use case for processing documents into commands.
 * Orchestrates the command processing pipeline (成果B→成果C→成果D).
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type {
  ExtractedData,
  Schema,
  Template,
} from "../../domain/models/entities.ts";
import {
  Command,
  type CommandCreationData,
} from "../../domain/command/index.ts";
import type { CommandProcessingContext } from "../services/command-processing-context.ts";

/**
 * ProcessCommandUseCase - Use Case for Stage 1 processing
 */
export class ProcessCommandUseCase {
  private constructor() {}

  /**
   * Smart constructor following totality principle
   */
  static create(): Result<
    ProcessCommandUseCase,
    DomainError & { message: string }
  > {
    return { ok: true, data: new ProcessCommandUseCase() };
  }

  /**
   * Process a single document into a command (成果B→成果C→成果D)
   */
  async processDocument(
    document: ExtractedData,
    context: CommandProcessingContext,
  ): Promise<Result<Command, DomainError & { message: string }>> {
    try {
      // Stage 1.1: Validate extracted frontmatter (成果B validation)
      const frontmatter = document.getData();
      if (!frontmatter) {
        return {
          ok: false,
          error: createDomainError({
            kind: "EmptyInput",
            field: "frontmatter",
          }),
        };
      }

      // Stage 1.2: Schema analysis (成果C)
      const analysisResult = await this.analyzeWithSchema(
        frontmatter,
        context.getCommandSchema(),
      );
      if (!analysisResult.ok) {
        return analysisResult;
      }

      // Stage 1.3: Template mapping (成果D)
      const mappingResult = await this.mapToCommandStructure(
        analysisResult.data,
        context.getCommandTemplate(),
      );
      if (!mappingResult.ok) {
        return mappingResult;
      }

      return { ok: true, data: mappingResult.data };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "document-processing",
          error: createDomainError({
            kind: "ParseError",
            input: "document",
            details: _error instanceof Error ? _error.message : "Unknown error",
          }),
        }),
      };
    }
  }

  /**
   * Process multiple documents in batch
   */
  async processDocuments(
    documents: ExtractedData[],
    context: CommandProcessingContext,
  ): Promise<Result<Command[], DomainError & { message: string }>> {
    const commands: Command[] = [];
    const errors: string[] = [];

    for (const document of documents) {
      const result = await this.processDocument(document, context);
      if (result.ok) {
        commands.push(result.data);
      } else {
        errors.push(
          `Document processing error: ${
            result.error.message || result.error.kind
          }`,
        );
      }
    }

    // In strict mode, fail if any document fails
    if (context.isStrict() && errors.length > 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "document-processing",
          error: createDomainError({
            kind: "InvalidFormat",
            input: `${errors.length} documents`,
            expectedFormat: "valid document structure",
          }),
        }),
      };
    }

    return { ok: true, data: commands };
  }

  /**
   * Schema analysis step (成果C)
   */
  private analyzeWithSchema(
    frontmatter: Record<string, unknown>,
    schema: Schema,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    try {
      // Extract fields matching the command schema
      const schemaProps = schema.getProperties();
      const analyzedData: Record<string, unknown> = {};

      for (const [key, _definition] of Object.entries(schemaProps)) {
        if (key in frontmatter) {
          analyzedData[key] = frontmatter[key];
        }
      }

      // Validate required fields
      const requiredFields = schema.getRequiredFields();
      for (const requiredField of requiredFields) {
        if (!(requiredField in analyzedData)) {
          return {
            ok: false,
            error: createDomainError({
              kind: "SchemaValidationFailed",
              schema: {},
              data: {},
              field: requiredField,
              details:
                `Required field '${requiredField}' not found in frontmatter`,
            }),
          };
        }
      }

      return { ok: true, data: analyzedData };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "document-processing",
          error: createDomainError({
            kind: "SchemaValidationFailed",
            schema: {},
            data: {},
          }),
        }),
      };
    }
  }

  /**
   * Template mapping step (成果D)
   */
  private mapToCommandStructure(
    analyzedData: Record<string, unknown>,
    template: Template,
  ): Result<Command, DomainError & { message: string }> {
    try {
      // Apply template rules to analyzed data
      const mappingResult = template.applyRules(analyzedData, {
        kind: "SimpleMapping",
      });

      // mappingResult is the transformed data directly
      const mappedData = typeof mappingResult === "object" &&
          mappingResult !== null &&
          !Array.isArray(mappingResult)
        ? mappingResult as Record<string, unknown>
        : {};

      // Create command using smart constructor
      const commandData: CommandCreationData = {
        c1: String(mappedData.c1 || ""),
        c2: String(mappedData.c2 || ""),
        c3: String(mappedData.c3 || ""),
        description: String(mappedData.description || ""),
        usage: String(mappedData.usage || ""),
        options: (mappedData.options as Record<string, unknown>) || {},
        title: mappedData.title ? String(mappedData.title) : undefined,
      };

      const command = Command.create(commandData);
      if (!command.ok) {
        return command;
      }

      return { ok: true, data: command.data };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "document-processing",
          error: createDomainError({
            kind: "TemplateMappingFailed",
            template: {},
            source: {},
          }),
        }),
      };
    }
  }
}
