/**
 * Minimal Test Maximum Coverage Strategy
 *
 * Provides patterns for writing fewer, more effective tests that are resistant to change
 * while maintaining comprehensive coverage of business logic.
 */

import type { DomainError, Result } from "../../src/domain/core/result.ts";
import { ResultAssert } from "./robust-test-framework.ts";

export interface CoreBehaviorTest<T, E = DomainError> {
  readonly description: string;
  readonly execute: () => Result<T, E> | Promise<Result<T, E>>;
  readonly expectations: TestExpectation<T, E>[];
}

export interface TestExpectation<T, E> {
  readonly type: "success" | "failure";
  readonly validate: (result: Result<T, E>) => void;
}

/**
 * Core Business Logic Test Runner
 * Focuses on testing the essential business behaviors rather than implementation details
 */
export class CoreLogicTester {
  /**
   * Tests the complete behavior of a business operation
   * This replaces multiple granular tests with one comprehensive test
   */
  static async testCoreBehavior<T, E>(
    t: Deno.TestContext,
    behaviorTest: CoreBehaviorTest<T, E>,
  ): Promise<void> {
    await t.step(behaviorTest.description, async () => {
      const result = await behaviorTest.execute();

      // Apply all expectations
      for (const expectation of behaviorTest.expectations) {
        expectation.validate(result);
      }
    });
  }

  /**
   * Batch tests multiple related behaviors
   * Reduces test count while maintaining coverage
   */
  static async testBehaviorGroup<T, E>(
    t: Deno.TestContext,
    groupName: string,
    behaviors: CoreBehaviorTest<T, E>[],
  ): Promise<void> {
    await t.step(groupName, async (groupStep) => {
      for (const behavior of behaviors) {
        await this.testCoreBehavior(groupStep, behavior);
      }
    });
  }
}

/**
 * Domain Invariant Testing
 * Tests that domain rules are always enforced regardless of input path
 */
export class InvariantTester {
  /**
   * Tests domain invariants across multiple scenarios
   */
  static async testDomainInvariant<T>(
    t: Deno.TestContext,
    invariantName: string,
    scenarios: Array<{
      description: string;
      setup: () => Promise<T> | T;
      invariantCheck: (subject: T) => boolean | Promise<boolean>;
    }>,
  ): Promise<void> {
    await t.step(
      `Domain Invariant: ${invariantName}`,
      async (invariantStep) => {
        for (const scenario of scenarios) {
          await invariantStep.step(scenario.description, async () => {
            const subject = await scenario.setup();
            const invariantHolds = await scenario.invariantCheck(subject);

            if (!invariantHolds) {
              throw new Error(
                `Domain invariant '${invariantName}' violated in scenario: ${scenario.description}`,
              );
            }
          });
        }
      },
    );
  }
}

/**
 * Error Path Consolidation
 * Groups related error scenarios to reduce test duplication
 */
export class ErrorPathTester {
  /**
   * Tests all error conditions for a domain operation
   */
  static async testErrorPaths<T, E extends DomainError & { message: string }>(
    t: Deno.TestContext,
    operationName: string,
    errorScenarios: Array<{
      scenario: string;
      execute: () => Result<T, E> | Promise<Result<T, E>>;
      expectedErrorKind: string;
      errorValidation?: (error: E) => void;
    }>,
  ): Promise<void> {
    await t.step(`${operationName} error handling`, async (errorStep) => {
      for (
        const { scenario, execute, expectedErrorKind, errorValidation }
          of errorScenarios
      ) {
        await errorStep.step(`should handle ${scenario}`, async () => {
          const result = await execute();

          ResultAssert.assertFailure(result, expectedErrorKind);

          if (errorValidation) {
            errorValidation(result.error);
          }
        });
      }
    });
  }
}

/**
 * Integration Test Patterns
 * Tests complete workflows with minimal setup
 */
export class WorkflowTester {
  /**
   * Tests end-to-end workflow with focus on business value
   */
  static async testWorkflow<TInput, TOutput, E>(
    t: Deno.TestContext,
    workflowName: string,
    workflow: {
      setup: () => Promise<TInput> | TInput;
      execute: (
        input: TInput,
      ) => Promise<Result<TOutput, E>> | Result<TOutput, E>;
      validate: (output: TOutput) => void | Promise<void>;
      cleanup?: () => Promise<void> | void;
    },
  ): Promise<void> {
    await t.step(`Workflow: ${workflowName}`, async () => {
      try {
        const input = await workflow.setup();
        const result = await workflow.execute(input);

        ResultAssert.assertSuccess(result);
        await workflow.validate(result.data);
      } finally {
        if (workflow.cleanup) {
          await workflow.cleanup();
        }
      }
    });
  }
}

/**
 * Property-Based Testing Helpers
 * Tests properties that should hold across many inputs
 */
export class PropertyTester {
  /**
   * Tests a property across generated inputs
   */
  static async testProperty<T>(
    t: Deno.TestContext,
    propertyName: string,
    inputGenerator: () => T[],
    propertyCheck: (input: T) => boolean | Promise<boolean>,
    maxTests = 100,
  ): Promise<void> {
    await t.step(`Property: ${propertyName}`, async () => {
      const inputs = inputGenerator();
      const testCount = Math.min(inputs.length, maxTests);

      for (let i = 0; i < testCount; i++) {
        const input = inputs[i];
        const holds = await propertyCheck(input);

        if (!holds) {
          throw new Error(
            `Property '${propertyName}' failed for input: ${
              JSON.stringify(input)
            }`,
          );
        }
      }
    });
  }
}

// Pre-built expectation factories for common scenarios
export class CommonExpectations {
  static success<T, E>(validate?: (data: T) => void): TestExpectation<T, E> {
    return {
      type: "success",
      validate: (result) => {
        ResultAssert.assertSuccess(result);
        if (validate) {
          validate(result.data);
        }
      },
    };
  }

  static failure<T, E extends { message: string }>(
    expectedErrorKind?: string,
    errorValidation?: (error: E) => void,
  ): TestExpectation<T, E> {
    return {
      type: "failure",
      validate: (result) => {
        ResultAssert.assertFailure(result, expectedErrorKind);
        if (errorValidation) {
          errorValidation(result.error);
        }
      },
    };
  }

  static validationError<T>(
    message?: string | RegExp,
  ): TestExpectation<T, DomainError & { message: string }> {
    return {
      type: "failure",
      validate: (result) => {
        ResultAssert.assertFailure(result);
        if (message) {
          if (typeof message === "string") {
            if (!result.error.message.includes(message)) {
              throw new Error(
                `Expected error message to contain '${message}', got: ${result.error.message}`,
              );
            }
          } else {
            if (!message.test(result.error.message)) {
              throw new Error(
                `Expected error message to match ${message}, got: ${result.error.message}`,
              );
            }
          }
        }
      },
    };
  }
}
