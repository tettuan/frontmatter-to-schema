import { Result } from "../../domain/shared/types/result.ts";
import { DomainError as _DomainError } from "../../domain/shared/types/errors.ts";
import { PipelineCommand, PipelineContext } from "./pipeline-state-machine.ts";

/**
 * Pipeline Command Factory - Generates command sequences based on context
 * Following Command Pattern with DDD and Totality principles
 */

export type CommandSequence = PipelineCommand[];

export type CommandGenerationError = {
  kind: "InvalidSchema";
  message: string;
};

/**
 * Generate the standard pipeline command sequence
 */
export function generateStandardSequence(
  _context: PipelineContext,
  inputContent: string,
): Result<CommandSequence, CommandGenerationError> {
  try {
    const commands: CommandSequence = [
      { kind: "ParseFrontmatter", input: inputContent },
      { kind: "LoadSchema", schemaPath: _context.schemaPath },
      { kind: "ValidateData" },
      { kind: "GenerateTemplate" },
      { kind: "Complete" },
    ];

    return {
      ok: true,
      data: commands,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "InvalidSchema",
        message: `Failed to generate command sequence: ${error}`,
      },
    };
  }
}

/**
 * Generate command sequence for validation-only mode
 */
export function generateValidationOnlySequence(
  _context: PipelineContext,
  inputContent: string,
): Result<CommandSequence, CommandGenerationError> {
  try {
    const commands: CommandSequence = [
      { kind: "ParseFrontmatter", input: inputContent },
      { kind: "LoadSchema", schemaPath: _context.schemaPath },
      { kind: "ValidateData" },
    ];

    return {
      ok: true,
      data: commands,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "InvalidSchema",
        message: `Failed to generate validation-only sequence: ${error}`,
      },
    };
  }
}

/**
 * Generate command sequence for template-only mode (skip validation)
 */
export function generateTemplateOnlySequence(
  _context: PipelineContext,
  inputContent: string,
): Result<CommandSequence, CommandGenerationError> {
  try {
    const commands: CommandSequence = [
      { kind: "ParseFrontmatter", input: inputContent },
      { kind: "GenerateTemplate" },
      { kind: "Complete" },
    ];

    return {
      ok: true,
      data: commands,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "InvalidSchema",
        message: `Failed to generate template-only sequence: ${error}`,
      },
    };
  }
}

/**
 * Command sequence factory with mode-based selection
 */
export function createCommandSequence(
  _context: PipelineContext,
  inputContent: string,
  mode: "standard" | "validation-only" | "template-only" = "standard",
): Result<CommandSequence, CommandGenerationError> {
  switch (mode) {
    case "standard":
      return generateStandardSequence(_context, inputContent);
    case "validation-only":
      return generateValidationOnlySequence(_context, inputContent);
    case "template-only":
      return generateTemplateOnlySequence(_context, inputContent);
  }
}

/**
 * Validate command sequence for context compatibility
 */
export function validateCommandSequence(
  sequence: CommandSequence,
  _context: PipelineContext,
): Result<boolean, CommandGenerationError> {
  try {
    // Check for required commands based on context
    const hasParseCommand = sequence.some((cmd) =>
      cmd.kind === "ParseFrontmatter"
    );
    if (!hasParseCommand) {
      return {
        ok: false,
        error: {
          kind: "InvalidSchema",
          message: "Command sequence must include ParseFrontmatter",
        },
      };
    }

    // Validate schema loading requirements
    const hasLoadSchema = sequence.some((cmd) => cmd.kind === "LoadSchema");
    const hasValidateData = sequence.some((cmd) => cmd.kind === "ValidateData");

    if (hasValidateData && !hasLoadSchema) {
      return {
        ok: false,
        error: {
          kind: "InvalidSchema",
          message: "ValidateData command requires LoadSchema command",
        },
      };
    }

    // Validate completion requirements
    const hasComplete = sequence.some((cmd) => cmd.kind === "Complete");
    const hasGenerateTemplate = sequence.some((cmd) =>
      cmd.kind === "GenerateTemplate"
    );

    if (hasComplete && !hasGenerateTemplate) {
      return {
        ok: false,
        error: {
          kind: "InvalidSchema",
          message: "Complete command requires GenerateTemplate command",
        },
      };
    }

    return {
      ok: true,
      data: true,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "InvalidSchema",
        message: `Failed to validate command sequence: ${error}`,
      },
    };
  }
}
