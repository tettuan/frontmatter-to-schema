import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { SchemaPath } from "../../domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../domain/schema/value-objects/schema-definition.ts";

/**
 * Pipeline State Machine - Replaces monolithic execute() method
 * with clean state transitions following DDD and Totality principles
 */

// State definitions using discriminated unions (Totality)
export type PipelineState =
  | { kind: "Initial"; context: PipelineContext }
  | {
    kind: "FrontmatterParsed";
    context: PipelineContext;
    data: FrontmatterData;
  }
  | {
    kind: "SchemaLoaded";
    context: PipelineContext;
    data: FrontmatterData;
    schema: Schema;
  }
  | {
    kind: "DataValidated";
    context: PipelineContext;
    data: FrontmatterData;
    schema: Schema;
  }
  | { kind: "TemplateGenerated"; context: PipelineContext; output: string }
  | { kind: "Completed"; result: string }
  | { kind: "Failed"; error: PipelineError };

// Command definitions for state transitions
export type PipelineCommand =
  | { kind: "ParseFrontmatter"; input: string }
  | { kind: "LoadSchema"; schemaPath: string }
  | { kind: "ValidateData" }
  | { kind: "GenerateTemplate" }
  | { kind: "Complete" };

// Error types specific to pipeline operations
export type PipelineError = {
  kind: "PipelineExecutionError";
  content: string;
  phase: string;
  originalError: DomainError;
};

// Context carries immutable configuration through state transitions
export interface PipelineContext {
  readonly inputPath: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly mode: "strict" | "lenient";
  readonly enableJMESPathFilters: boolean;
}

/**
 * Pure state transition function - no side effects
 * Each transition is total (handles all possible states)
 */
export function transition(
  state: PipelineState,
  command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  // Exhaustive pattern matching - no default case (Totality)
  switch (state.kind) {
    case "Initial":
      return handleInitialState(state, command);
    case "FrontmatterParsed":
      return handleFrontmatterParsedState(state, command);
    case "SchemaLoaded":
      return handleSchemaLoadedState(state, command);
    case "DataValidated":
      return handleDataValidatedState(state, command);
    case "TemplateGenerated":
      return handleTemplateGeneratedState(state, command);
    case "Completed":
      return handleCompletedState(state, command);
    case "Failed":
      return handleFailedState(state, command);
  }
}

// State-specific transition handlers (all total functions)

function handleInitialState(
  state: Extract<PipelineState, { kind: "Initial" }>,
  command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  if (command.kind === "ParseFrontmatter") {
    // Create empty frontmatter data using static empty method
    const emptyData = FrontmatterData.empty();

    return {
      ok: true,
      data: {
        kind: "FrontmatterParsed",
        context: state.context,
        data: emptyData,
      },
    };
  }

  return {
    ok: false,
    error: {
      kind: "PipelineExecutionError",
      content: `Invalid command ${command.kind} for Initial state`,
      phase: "Initial",
      originalError: {
        kind: "InvalidSchema",
        message: `Invalid command ${command.kind} for Initial state`,
      },
    },
  };
}

function handleFrontmatterParsedState(
  state: Extract<PipelineState, { kind: "FrontmatterParsed" }>,
  command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  if (command.kind === "LoadSchema") {
    // Create a minimal schema for prototype state machine testing
    // This is a placeholder - in real implementation, this would load from file
    const schemaPath = SchemaPath.create(command.schemaPath);
    if (!schemaPath.ok) {
      return {
        ok: false,
        error: {
          kind: "PipelineExecutionError",
          content: "Invalid schema path",
          phase: "FrontmatterParsed",
          originalError: schemaPath.error,
        },
      };
    }

    const schemaDefinition = SchemaDefinition.create({
      type: "object",
      properties: {},
    });
    if (!schemaDefinition.ok) {
      return {
        ok: false,
        error: {
          kind: "PipelineExecutionError",
          content: "Failed to create schema definition",
          phase: "FrontmatterParsed",
          originalError: schemaDefinition.error,
        },
      };
    }

    const schema = Schema.create(schemaPath.data, schemaDefinition.data);
    if (!schema.ok) {
      return {
        ok: false,
        error: {
          kind: "PipelineExecutionError",
          content: "Failed to create schema",
          phase: "FrontmatterParsed",
          originalError: schema.error,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "SchemaLoaded",
        context: state.context,
        data: state.data,
        schema: schema.data,
      },
    };
  }

  if (command.kind === "GenerateTemplate") {
    // Allow direct template generation for template-only mode
    return {
      ok: true,
      data: {
        kind: "TemplateGenerated",
        context: state.context,
        output: "generated template content without validation",
      },
    };
  }

  return {
    ok: false,
    error: {
      kind: "PipelineExecutionError",
      content: `Invalid command ${command.kind} for FrontmatterParsed state`,
      phase: "FrontmatterParsed",
      originalError: {
        kind: "InvalidSchema",
        message: `Invalid command ${command.kind} for FrontmatterParsed state`,
      },
    },
  };
}

function handleSchemaLoadedState(
  state: Extract<PipelineState, { kind: "SchemaLoaded" }>,
  command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  if (command.kind === "ValidateData") {
    // This would delegate to validation service
    return {
      ok: true,
      data: {
        kind: "DataValidated",
        context: state.context,
        data: state.data,
        schema: state.schema,
      },
    };
  }

  return {
    ok: false,
    error: {
      kind: "PipelineExecutionError",
      content: `Invalid command ${command.kind} for SchemaLoaded state`,
      phase: "SchemaLoaded",
      originalError: {
        kind: "InvalidSchema",
        message: `Invalid command ${command.kind} for SchemaLoaded state`,
      },
    },
  };
}

function handleDataValidatedState(
  state: Extract<PipelineState, { kind: "DataValidated" }>,
  command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  if (command.kind === "GenerateTemplate") {
    // This would delegate to template generation service
    return {
      ok: true,
      data: {
        kind: "TemplateGenerated",
        context: state.context,
        output: "generated template content",
      },
    };
  }

  return {
    ok: false,
    error: {
      kind: "PipelineExecutionError",
      content: `Invalid command ${command.kind} for DataValidated state`,
      phase: "DataValidated",
      originalError: {
        kind: "InvalidSchema",
        message: `Invalid command ${command.kind} for DataValidated state`,
      },
    },
  };
}

function handleTemplateGeneratedState(
  state: Extract<PipelineState, { kind: "TemplateGenerated" }>,
  command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  if (command.kind === "Complete") {
    return {
      ok: true,
      data: {
        kind: "Completed",
        result: state.output,
      },
    };
  }

  return {
    ok: false,
    error: {
      kind: "PipelineExecutionError",
      content: `Invalid command ${command.kind} for TemplateGenerated state`,
      phase: "TemplateGenerated",
      originalError: {
        kind: "InvalidSchema",
        message: `Invalid command ${command.kind} for TemplateGenerated state`,
      },
    },
  };
}

function handleCompletedState(
  _state: Extract<PipelineState, { kind: "Completed" }>,
  command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  return {
    ok: false,
    error: {
      kind: "PipelineExecutionError",
      content: `Cannot execute command ${command.kind} on completed pipeline`,
      phase: "Completed",
      originalError: {
        kind: "InvalidSchema",
        message: `Cannot execute command ${command.kind} on completed pipeline`,
      },
    },
  };
}

function handleFailedState(
  state: Extract<PipelineState, { kind: "Failed" }>,
  _command: PipelineCommand,
): Result<PipelineState, PipelineError> {
  return {
    ok: false,
    error: state.error,
  };
}

/**
 * Pipeline State Machine smart constructor
 */
export function createPipelineStateMachine(
  context: PipelineContext,
): Result<PipelineState, PipelineError> {
  return {
    ok: true,
    data: {
      kind: "Initial",
      context,
    },
  };
}

/**
 * Execute a sequence of commands on the state machine
 */
export function executeCommands(
  initialState: PipelineState,
  commands: PipelineCommand[],
): Result<PipelineState, PipelineError> {
  let currentState = initialState;

  for (const command of commands) {
    const transitionResult = transition(currentState, command);
    if (!transitionResult.ok) {
      return transitionResult;
    }
    currentState = transitionResult.data;
  }

  return {
    ok: true,
    data: currentState,
  };
}
