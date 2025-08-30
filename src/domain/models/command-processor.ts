/**
 * CommandProcessor - Aggregate Root for Stage 1 Processing
 * 
 * Handles individual command processing:
 * - Extracts frontmatter (成果B)
 * - Analyzes with schema (成果C) 
 * - Maps to command structure (成果D)
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { ExtractedData, Template } from "./entities.ts";
import type { Schema } from "./value-objects.ts";

/**
 * Command represents a single processed command (成果D)
 */
export interface Command {
  c1: string;
  c2: string;
  c3: string;
  title?: string;
  description: string;
  usage: string;
  options: {
    input?: string[];
    adaptation?: string[];
    file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };
}

/**
 * Command processing context
 */
export interface CommandProcessingContext {
  commandSchema: Schema;
  commandTemplate: Template;
  strictMode?: boolean;
}

/**
 * CommandProcessor - Aggregate Root for Stage 1 processing
 */
export class CommandProcessor {
  private constructor() {}

  /**
   * Smart constructor following totality principle
   */
  static create(): Result<CommandProcessor, DomainError & { message: string }> {
    return { ok: true, data: new CommandProcessor() };
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
      const frontmatter = document.getFrontMatter();
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
        context.commandSchema,
      );
      if (!analysisResult.ok) {
        return analysisResult;
      }

      // Stage 1.3: Template mapping (成果D)
      const mappingResult = await this.mapToCommandStructure(
        analysisResult.data,
        context.commandTemplate,
      );
      if (!mappingResult.ok) {
        return mappingResult;
      }

      return { ok: true, data: mappingResult.data };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingError",
          details: error instanceof Error ? error.message : "Unknown error",
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
        errors.push(`Document ${document.getDocumentPath()}: ${result.error.message || result.error.kind}`);
      }
    }

    // In strict mode, fail if any document fails
    if (context.strictMode && errors.length > 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingError",
          details: `Failed to process ${errors.length} documents: ${errors.join(", ")}`,
        }),
      };
    }

    return { ok: true, data: commands };
  }

  /**
   * Schema analysis step (成果C)
   */
  private async analyzeWithSchema(
    frontmatter: Record<string, unknown>,
    schema: Schema,
  ): Promise<Result<Record<string, unknown>, DomainError & { message: string }>> {
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
              kind: "ValidationError",
              field: requiredField,
              details: `Required field '${requiredField}' not found in frontmatter`,
            }),
          };
        }
      }

      return { ok: true, data: analyzedData };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingError",
          details: error instanceof Error ? error.message : "Schema analysis failed",
        }),
      };
    }
  }

  /**
   * Template mapping step (成果D)
   */
  private async mapToCommandStructure(
    analyzedData: Record<string, unknown>,
    template: Template,
  ): Promise<Result<Command, DomainError & { message: string }>> {
    try {
      // Apply template mapping to create command structure
      const mappingResult = template.applyTemplate(analyzedData);
      if (!mappingResult.ok) {
        return mappingResult;
      }

      const mappedData = mappingResult.data.getData();

      // Validate command structure
      const command = this.validateCommandStructure(mappedData);
      if (!command.ok) {
        return command;
      }

      return { ok: true, data: command.data };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingError",
          details: error instanceof Error ? error.message : "Template mapping failed",
        }),
      };
    }
  }

  /**
   * Validate the mapped data conforms to Command interface
   */
  private validateCommandStructure(
    data: Record<string, unknown>,
  ): Result<Command, DomainError & { message: string }> {
    // Validate required C3L fields
    if (typeof data.c1 !== "string" || !data.c1.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ValidationError",
          field: "c1",
          details: "Command c1 (domain/category) is required and must be a non-empty string",
        }),
      };
    }

    if (typeof data.c2 !== "string" || !data.c2.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ValidationError",
          field: "c2",
          details: "Command c2 (action/directive) is required and must be a non-empty string",
        }),
      };
    }

    if (typeof data.c3 !== "string" || !data.c3.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ValidationError",
          field: "c3",
          details: "Command c3 (target/layer) is required and must be a non-empty string",
        }),
      };
    }

    if (typeof data.description !== "string" || !data.description.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ValidationError",
          field: "description",
          details: "Command description is required and must be a non-empty string",
        }),
      };
    }

    if (typeof data.usage !== "string" || !data.usage.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ValidationError",
          field: "usage",
          details: "Command usage is required and must be a non-empty string",
        }),
      };
    }

    // Create validated command object
    const command: Command = {
      c1: data.c1 as string,
      c2: data.c2 as string,
      c3: data.c3 as string,
      description: data.description as string,
      usage: data.usage as string,
      options: (data.options as Command["options"]) || {},
    };

    // Add optional fields if present
    if (typeof data.title === "string" && data.title.trim()) {
      command.title = data.title;
    }

    return { ok: true, data: command };
  }
}

/**
 * Type guard for Command interface
 */
export function isCommand(value: unknown): value is Command {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cmd = value as Record<string, unknown>;
  
  return (
    typeof cmd.c1 === "string" &&
    typeof cmd.c2 === "string" &&
    typeof cmd.c3 === "string" &&
    typeof cmd.description === "string" &&
    typeof cmd.usage === "string" &&
    typeof cmd.options === "object" &&
    cmd.options !== null
  );
}