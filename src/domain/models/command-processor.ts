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
import type { Schema } from "./entities.ts";

/**
 * Command options using discriminated union pattern (Totality principle)
 * Replaces optional properties with explicit states
 */
export type CommandOptions =
  | { kind: "basic"; hasFile: false; hasStdin: false; hasDestination: false }
  | {
    kind: "file-only";
    hasFile: true;
    file: boolean[];
    hasStdin: false;
    hasDestination: false;
  }
  | {
    kind: "stdin-only";
    hasStdin: true;
    stdin: boolean[];
    hasFile: false;
    hasDestination: false;
  }
  | {
    kind: "destination-only";
    hasDestination: true;
    destination: boolean[];
    hasFile: false;
    hasStdin: false;
  }
  | {
    kind: "full";
    input?: string[];
    adaptation?: string[];
    file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };

/**
 * Command data for creation
 */
export interface CommandCreationData {
  c1: string;
  c2: string;
  c3: string;
  description: string;
  usage: string;
  options: Record<string, unknown>;
  title?: string;
}

/**
 * Command class using Smart Constructor pattern (Totality principle)
 * Replaces interface with class to ensure only valid instances can be created
 */
export class Command {
  private constructor(
    private readonly c1: string,
    private readonly c2: string,
    private readonly c3: string,
    private readonly description: string,
    private readonly usage: string,
    private readonly options: CommandOptions,
    private readonly title?: string,
  ) {}

  /**
   * Smart constructor following totality principle
   * Ensures only valid Command instances can be created
   */
  static create(
    data: CommandCreationData,
  ): Result<Command, DomainError & { message: string }> {
    // Validate required C3L fields
    if (typeof data.c1 !== "string" || !data.c1.trim()) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data.c1),
            expectedFormat: "non-empty string",
          },
          "Command c1 (domain/category) is required and must be a non-empty string",
        ),
      };
    }

    if (typeof data.c2 !== "string" || !data.c2.trim()) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data.c2),
            expectedFormat: "non-empty string",
          },
          "Command c2 (action/directive) is required and must be a non-empty string",
        ),
      };
    }

    if (typeof data.c3 !== "string" || !data.c3.trim()) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data.c3),
            expectedFormat: "non-empty string",
          },
          "Command c3 (target/layer) is required and must be a non-empty string",
        ),
      };
    }

    if (typeof data.description !== "string" || !data.description.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(data.description),
          expectedFormat: "non-empty string",
        }, "Command description is required and must be a non-empty string"),
      };
    }

    if (typeof data.usage !== "string" || !data.usage.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(data.usage),
          expectedFormat: "non-empty string",
        }, "Command usage is required and must be a non-empty string"),
      };
    }

    // Parse options into discriminated union
    const optionsResult = Command.parseOptions(data.options);
    if (!optionsResult.ok) {
      return optionsResult;
    }

    // Validate optional title if present
    if (
      data.title !== undefined &&
      (typeof data.title !== "string" || !data.title.trim())
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(data.title),
          expectedFormat: "non-empty string or undefined",
        }, "Command title must be a non-empty string if provided"),
      };
    }

    return {
      ok: true,
      data: new Command(
        data.c1.trim(),
        data.c2.trim(),
        data.c3.trim(),
        data.description.trim(),
        data.usage.trim(),
        optionsResult.data,
        data.title?.trim(),
      ),
    };
  }

  /**
   * Parse options object into discriminated union
   */
  private static parseOptions(
    options: Record<string, unknown>,
  ): Result<CommandOptions, DomainError & { message: string }> {
    const hasFile = Array.isArray(options.file);
    const hasStdin = Array.isArray(options.stdin);
    const hasDestination = Array.isArray(options.destination);
    const hasInput = Array.isArray(options.input);
    const hasAdaptation = Array.isArray(options.adaptation);

    // Determine the appropriate discriminated union case
    if (
      !hasFile && !hasStdin && !hasDestination && !hasInput && !hasAdaptation
    ) {
      return {
        ok: true,
        data: {
          kind: "basic",
          hasFile: false,
          hasStdin: false,
          hasDestination: false,
        },
      };
    }

    if (hasFile && !hasStdin && !hasDestination) {
      return {
        ok: true,
        data: {
          kind: "file-only",
          hasFile: true,
          file: options.file as boolean[],
          hasStdin: false,
          hasDestination: false,
        },
      };
    }

    if (!hasFile && hasStdin && !hasDestination) {
      return {
        ok: true,
        data: {
          kind: "stdin-only",
          hasStdin: true,
          stdin: options.stdin as boolean[],
          hasFile: false,
          hasDestination: false,
        },
      };
    }

    if (!hasFile && !hasStdin && hasDestination) {
      return {
        ok: true,
        data: {
          kind: "destination-only",
          hasDestination: true,
          destination: options.destination as boolean[],
          hasFile: false,
          hasStdin: false,
        },
      };
    }

    // Default to full options for complex cases
    return {
      ok: true,
      data: {
        kind: "full",
        input: hasInput ? options.input as string[] : undefined,
        adaptation: hasAdaptation ? options.adaptation as string[] : undefined,
        file: hasFile ? options.file as boolean[] : undefined,
        stdin: hasStdin ? options.stdin as boolean[] : undefined,
        destination: hasDestination
          ? options.destination as boolean[]
          : undefined,
      },
    };
  }

  // Getters following encapsulation principles
  getC1(): string {
    return this.c1;
  }

  getC2(): string {
    return this.c2;
  }

  getC3(): string {
    return this.c3;
  }

  getDescription(): string {
    return this.description;
  }

  getUsage(): string {
    return this.usage;
  }

  getOptions(): CommandOptions {
    return this.options;
  }

  getTitle(): string | undefined {
    return this.title;
  }

  /**
   * Convert to legacy interface format for backwards compatibility
   * @deprecated Use the new Command class methods instead
   */
  toLegacyInterface(): {
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
  } {
    const legacyOptions: {
      input?: string[];
      adaptation?: string[];
      file?: boolean[];
      stdin?: boolean[];
      destination?: boolean[];
    } = {};

    switch (this.options.kind) {
      case "basic":
        // No options
        break;
      case "file-only":
        legacyOptions.file = this.options.file;
        break;
      case "stdin-only":
        legacyOptions.stdin = this.options.stdin;
        break;
      case "destination-only":
        legacyOptions.destination = this.options.destination;
        break;
      case "full":
        if (this.options.input) legacyOptions.input = this.options.input;
        if (this.options.adaptation) {
          legacyOptions.adaptation = this.options.adaptation;
        }
        if (this.options.file) legacyOptions.file = this.options.file;
        if (this.options.stdin) legacyOptions.stdin = this.options.stdin;
        if (this.options.destination) {
          legacyOptions.destination = this.options.destination;
        }
        break;
    }

    return {
      c1: this.c1,
      c2: this.c2,
      c3: this.c3,
      title: this.title,
      description: this.description,
      usage: this.usage,
      options: legacyOptions,
    };
  }
}

/**
 * Processing mode using discriminated union (Totality principle)
 */
export type ProcessingMode =
  | { kind: "strict"; validation: "fail-fast" }
  | { kind: "lenient"; validation: "continue-on-error"; maxErrors: number };

/**
 * Command processing context using Smart Constructor pattern
 * Replaces interface with class to ensure only valid contexts can be created
 */
export class CommandProcessingContext {
  private constructor(
    private readonly commandSchema: Schema,
    private readonly commandTemplate: Template,
    private readonly mode: ProcessingMode,
  ) {}

  /**
   * Smart constructor for strict processing mode
   */
  static createStrict(
    commandSchema: Schema,
    commandTemplate: Template,
  ): Result<CommandProcessingContext, DomainError & { message: string }> {
    const mode: ProcessingMode = { kind: "strict", validation: "fail-fast" };
    return {
      ok: true,
      data: new CommandProcessingContext(commandSchema, commandTemplate, mode),
    };
  }

  /**
   * Smart constructor for lenient processing mode
   */
  static createLenient(
    commandSchema: Schema,
    commandTemplate: Template,
    maxErrors: number = 10,
  ): Result<CommandProcessingContext, DomainError & { message: string }> {
    if (maxErrors < 1) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: maxErrors,
          min: 1,
        }, "Maximum errors must be at least 1"),
      };
    }

    const mode: ProcessingMode = {
      kind: "lenient",
      validation: "continue-on-error",
      maxErrors,
    };
    return {
      ok: true,
      data: new CommandProcessingContext(commandSchema, commandTemplate, mode),
    };
  }

  /**
   * Create context from legacy boolean flag (backwards compatibility)
   * @deprecated Use createStrict() or createLenient() instead
   */
  static fromStrictMode(
    commandSchema: Schema,
    commandTemplate: Template,
    strictMode: boolean = false,
  ): Result<CommandProcessingContext, DomainError & { message: string }> {
    return strictMode
      ? CommandProcessingContext.createStrict(commandSchema, commandTemplate)
      : CommandProcessingContext.createLenient(commandSchema, commandTemplate);
  }

  getCommandSchema(): Schema {
    return this.commandSchema;
  }

  getCommandTemplate(): Template {
    return this.commandTemplate;
  }

  getMode(): ProcessingMode {
    return this.mode;
  }

  isStrict(): boolean {
    return this.mode.kind === "strict";
  }

  isLenient(): boolean {
    return this.mode.kind === "lenient";
  }

  getMaxErrors(): number | undefined {
    return this.mode.kind === "lenient" ? this.mode.maxErrors : undefined;
  }
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
