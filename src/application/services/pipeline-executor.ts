import { Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import {
  createPipelineStateMachine,
  executeCommands,
  PipelineContext,
  PipelineError,
  PipelineState as _PipelineState,
} from "./pipeline-state-machine.ts";
import {
  createCommandSequence,
  validateCommandSequence,
} from "./pipeline-command-factory.ts";

/**
 * Pipeline Executor - High-level facade for pipeline operations
 * Replaces the monolithic PipelineOrchestrator.execute() method
 * with clean DDD and Totality principles
 */

export interface PipelineExecutorDependencies {
  // Dependencies will be injected here when implementing actual service calls
  readonly frontmatterParser?: unknown;
  readonly schemaLoader?: unknown;
  readonly validator?: unknown;
  readonly templateGenerator?: unknown;
}

export class PipelineExecutor {
  constructor(
    private readonly dependencies: PipelineExecutorDependencies = {},
  ) {}

  /**
   * Execute pipeline with new state machine architecture
   * This replaces the 567-line monolithic execute() method
   */
  execute(
    inputContent: string,
    context: PipelineContext,
    mode: "standard" | "validation-only" | "template-only" = "standard",
  ): Result<string, PipelineError> {
    try {
      // Create initial state machine
      const stateMachineResult = createPipelineStateMachine(context);
      if (!stateMachineResult.ok) {
        return {
          ok: false,
          error: {
            kind: "PipelineExecutionError",
            content: "Failed to create state machine",
            phase: "StateMachineCreation",
            originalError: {
              kind: "InvalidSchema",
              message: "Failed to create state machine",
            },
          },
        };
      }

      // Generate command sequence based on mode
      const commandSequenceResult = createCommandSequence(
        context,
        inputContent,
        mode,
      );
      if (!commandSequenceResult.ok) {
        return {
          ok: false,
          error: {
            kind: "PipelineExecutionError",
            content: "Failed to generate command sequence",
            phase: "CommandGeneration",
            originalError: commandSequenceResult.error,
          },
        };
      }

      // Validate command sequence
      const validationResult = validateCommandSequence(
        commandSequenceResult.data,
        context,
      );
      if (!validationResult.ok) {
        return {
          ok: false,
          error: {
            kind: "PipelineExecutionError",
            content: "Failed to validate command sequence",
            phase: "CommandValidation",
            originalError: validationResult.error,
          },
        };
      }

      // Execute command sequence
      const executionResult = executeCommands(
        stateMachineResult.data,
        commandSequenceResult.data,
      );
      if (!executionResult.ok) {
        return executionResult;
      }

      // Extract result from final state
      const finalState = executionResult.data;
      if (finalState.kind === "Completed") {
        return {
          ok: true,
          data: finalState.result,
        };
      }

      // Handle incomplete execution
      return {
        ok: false,
        error: {
          kind: "PipelineExecutionError",
          content: `Pipeline ended in unexpected state: ${finalState.kind}`,
          phase: "Completion",
          originalError: {
            kind: "InvalidSchema",
            message: `Pipeline ended in unexpected state: ${finalState.kind}`,
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "PipelineExecutionError",
          content: `Unexpected error during pipeline execution: ${error}`,
          phase: "Execution",
          originalError: {
            kind: "InvalidSchema",
            message: `Unexpected error during pipeline execution: ${error}`,
          },
        },
      };
    }
  }

  /**
   * Validate input without full processing
   */
  validateOnly(
    inputContent: string,
    context: PipelineContext,
  ): Result<boolean, PipelineError> {
    try {
      // Create initial state machine
      const stateMachineResult = createPipelineStateMachine(context);
      if (!stateMachineResult.ok) {
        return {
          ok: false,
          error: {
            kind: "PipelineExecutionError",
            content: "Failed to create state machine for validation",
            phase: "StateMachineCreation",
            originalError: {
              kind: "InvalidSchema",
              message: "Failed to create state machine",
            },
          },
        };
      }

      // Generate validation-only command sequence
      const commandSequenceResult = createCommandSequence(
        context,
        inputContent,
        "validation-only",
      );
      if (!commandSequenceResult.ok) {
        return {
          ok: false,
          error: {
            kind: "PipelineExecutionError",
            content: "Failed to generate validation command sequence",
            phase: "CommandGeneration",
            originalError: commandSequenceResult.error,
          },
        };
      }

      // Execute validation sequence
      const executionResult = executeCommands(
        stateMachineResult.data,
        commandSequenceResult.data,
      );
      if (!executionResult.ok) {
        return {
          ok: false,
          error: executionResult.error,
        };
      }

      // Check if validation completed successfully
      const finalState = executionResult.data;
      if (finalState.kind === "DataValidated") {
        return {
          ok: true,
          data: true,
        };
      }

      return {
        ok: false,
        error: {
          kind: "PipelineExecutionError",
          content: `Validation ended in unexpected state: ${finalState.kind}`,
          phase: "Validation",
          originalError: {
            kind: "InvalidSchema",
            message: `Validation ended in unexpected state: ${finalState.kind}`,
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "PipelineExecutionError",
          content: `Unexpected error during validation: ${error}`,
          phase: "Validation",
          originalError: {
            kind: "InvalidSchema",
            message: `Unexpected error during validation: ${error}`,
          },
        },
      };
    }
  }

  /**
   * Generate template without validation
   */
  generateTemplateOnly(
    inputContent: string,
    context: PipelineContext,
  ): Result<string, PipelineError> {
    return this.execute(inputContent, context, "template-only");
  }

  /**
   * Get current pipeline capabilities
   */
  getCapabilities(): {
    supportsValidation: boolean;
    supportsTemplateGeneration: boolean;
    supportsJMESPathFilters: boolean;
  } {
    return {
      supportsValidation: true,
      supportsTemplateGeneration: true,
      supportsJMESPathFilters: true,
    };
  }
}

/**
 * Smart constructor for PipelineExecutor
 */
export function createPipelineExecutor(
  dependencies: PipelineExecutorDependencies = {},
): Result<PipelineExecutor, DomainError> {
  try {
    return {
      ok: true,
      data: new PipelineExecutor(dependencies),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "InvalidSchema",
        message: `Failed to create PipelineExecutor: ${error}`,
      },
    };
  }
}

/**
 * Context builder with validation
 */
export function createPipelineContext(
  inputPath: string,
  schemaPath: string,
  outputPath: string,
  options: {
    mode?: "strict" | "lenient";
    enableJMESPathFilters?: boolean;
  } = {},
): Result<PipelineContext, DomainError> {
  try {
    if (!inputPath.trim()) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: "path",
          value: inputPath,
          field: "inputPath",
        },
      };
    }

    if (!schemaPath.trim()) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: "path",
          value: schemaPath,
          field: "schemaPath",
        },
      };
    }

    if (!outputPath.trim()) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: "path",
          value: outputPath,
          field: "outputPath",
        },
      };
    }

    return {
      ok: true,
      data: {
        inputPath: inputPath.trim(),
        schemaPath: schemaPath.trim(),
        outputPath: outputPath.trim(),
        mode: options.mode ?? "strict",
        enableJMESPathFilters: options.enableJMESPathFilters ?? true,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "InvalidSchema",
        message: `Failed to create pipeline context: ${error}`,
      },
    };
  }
}
