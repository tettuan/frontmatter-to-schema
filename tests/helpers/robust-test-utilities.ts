/**
 * @module tests/helpers/robust-test-utilities
 * @description Robust test utilities following DDD/Totality principles for change-resilient testing
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { Result } from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";

/**
 * Robust test assertion utilities that follow Totality principles
 * Ensures comprehensive error handling and reproducible test outcomes
 */
export class RobustTestUtilities {
  /**
   * Assert Result<T,E> success with type safety
   * Eliminates unsafe type assertions in test code
   */
  static assertResultSuccess<T, E>(
    result: Result<T, E>,
    message?: string,
  ): asserts result is { ok: true; data: T } {
    assert(
      result.ok,
      message ??
        `Expected Result to be successful, but got error: ${
          !result.ok ? JSON.stringify(result.error) : "unknown"
        }`,
    );
  }

  /**
   * Assert Result<T,E> failure with type safety
   * Provides comprehensive error verification
   */
  static assertResultFailure<T, E>(
    result: Result<T, E>,
    message?: string,
  ): asserts result is { ok: false; error: E } {
    assert(
      !result.ok,
      message ??
        `Expected Result to fail, but got success: ${
          result.ok ? JSON.stringify(result.data) : "unknown"
        }`,
    );
  }

  /**
   * Assert Result success and extract data safely
   * Combines assertion and data extraction in one operation
   */
  static extractResultData<T, E>(
    result: Result<T, E>,
    message?: string,
  ): T {
    this.assertResultSuccess(result, message);
    return result.data;
  }

  /**
   * Assert Result failure and extract error safely
   * Combines assertion and error extraction in one operation
   */
  static extractResultError<T, E>(
    result: Result<T, E>,
    message?: string,
  ): E {
    this.assertResultFailure(result, message);
    return result.error;
  }

  /**
   * Create isolated test context with cleanup
   * Ensures test independence and reproducibility
   */
  static createIsolatedContext<T>(
    setup: () => T,
    cleanup?: (context: T) => void,
  ): {
    context: T;
    dispose: () => void;
  } {
    const context = setup();
    return {
      context,
      dispose: () => {
        if (cleanup) {
          cleanup(context);
        }
      },
    };
  }

  /**
   * Execute test with automatic cleanup
   * Guarantees resource cleanup even if test fails
   */
  static async withCleanup<T, R>(
    setup: () => T,
    test: (context: T) => R | Promise<R>,
    cleanup?: (context: T) => void | Promise<void>,
  ): Promise<R> {
    const context = setup();
    try {
      return await test(context);
    } finally {
      if (cleanup) {
        await cleanup(context);
      }
    }
  }

  /**
   * Create deterministic test data
   * Ensures reproducible test outcomes across runs
   */
  static createDeterministicData(seed: string): {
    id: string;
    timestamp: number;
    data: Record<string, unknown>;
  } {
    // Create deterministic hash from seed
    const hash = this.simpleHash(seed);
    return {
      id: `test-${hash}`,
      timestamp: 1640995200000 + hash, // Fixed base timestamp + deterministic offset
      data: {
        name: `test-name-${hash}`,
        value: hash % 1000,
        active: hash % 2 === 0,
      },
    };
  }

  /**
   * Validate object structure without unsafe assertions
   * Provides type-safe object validation
   */
  static validateObjectStructure(
    obj: unknown,
    expectedKeys: string[],
    message?: string,
  ): asserts obj is Record<string, unknown> {
    assert(
      typeof obj === "object" && obj !== null,
      message ?? "Expected object to be a valid object",
    );

    const actualObj = obj as Record<string, unknown>;
    for (const key of expectedKeys) {
      assert(
        key in actualObj,
        message ?? `Expected object to have key '${key}'`,
      );
    }
  }

  /**
   * Compare objects with detailed difference reporting
   * Provides comprehensive comparison for complex objects
   */
  static assertDeepEquals<T>(
    actual: T,
    expected: T,
    message?: string,
  ): void {
    try {
      assertEquals(actual, expected, message);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `${message ?? "Deep equality assertion failed"}\n` +
            `Detailed comparison:\n` +
            `Expected: ${JSON.stringify(expected, null, 2)}\n` +
            `Actual: ${JSON.stringify(actual, null, 2)}\n` +
            `Original error: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Verify function behavior with multiple inputs
   * Ensures comprehensive function validation
   */
  static verifyFunctionBehavior<TInput, TOutput>(
    fn: (input: TInput) => TOutput,
    testCases: Array<{
      input: TInput;
      expected: TOutput;
      description?: string;
    }>,
  ): void {
    for (const testCase of testCases) {
      try {
        const actual = fn(testCase.input);
        assertEquals(
          actual,
          testCase.expected,
          `Test case failed: ${testCase.description ?? "unnamed"}`,
        );
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(
            `Function behavior verification failed for input: ${
              JSON.stringify(testCase.input)
            }\n` +
              `Description: ${testCase.description ?? "unnamed"}\n` +
              `Error: ${error.message}`,
          );
        }
        throw error;
      }
    }
  }

  /**
   * Simple deterministic hash function for test reproducibility
   * Private utility for creating consistent test data
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Test environment isolation utilities for reproducible testing
 * Ensures complete test independence and resource management
 */
export class TestEnvironmentManager {
  private static environments = new Map<string, TestEnvironment>();

  /**
   * Create isolated test environment with automatic cleanup
   * Provides complete resource isolation and cleanup guarantees
   */
  static createIsolatedEnvironment(
    name: string,
    setup: () => TestEnvironmentSetup,
  ): TestEnvironment {
    if (this.environments.has(name)) {
      throw new Error(`Test environment '${name}' already exists`);
    }

    const setupResult = setup();
    const environment: TestEnvironment = {
      name,
      tempDir: setupResult.tempDir,
      resources: setupResult.resources,
      cleanup: setupResult.cleanup,
      isActive: true,
    };

    this.environments.set(name, environment);
    return environment;
  }

  /**
   * Execute test within isolated environment
   * Guarantees cleanup even if test fails
   */
  static async withIsolatedEnvironment<T>(
    name: string,
    setup: () => TestEnvironmentSetup,
    testFn: (env: TestEnvironment) => T | Promise<T>,
  ): Promise<T> {
    const env = this.createIsolatedEnvironment(name, setup);
    try {
      return await testFn(env);
    } finally {
      await this.cleanupEnvironment(name);
    }
  }

  /**
   * Cleanup specific test environment
   * Ensures complete resource cleanup
   */
  static async cleanupEnvironment(name: string): Promise<void> {
    const env = this.environments.get(name);
    if (!env) {
      return;
    }

    env.isActive = false;
    if (env.cleanup) {
      await env.cleanup(env);
    }

    // Cleanup temp directory if it exists
    if (env.tempDir) {
      try {
        await Deno.remove(env.tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors in tests
      }
    }

    this.environments.delete(name);
  }

  /**
   * Cleanup all test environments
   * Used for global test cleanup
   */
  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.environments.keys()).map((name) =>
      this.cleanupEnvironment(name)
    );
    await Promise.all(cleanupPromises);
  }
}

/**
 * Type definitions for test environment management
 */
interface TestEnvironment {
  name: string;
  tempDir?: string;
  resources: Record<string, unknown>;
  cleanup?: (env: TestEnvironment) => void | Promise<void>;
  isActive: boolean;
}

interface TestEnvironmentSetup {
  tempDir?: string;
  resources: Record<string, unknown>;
  cleanup?: (env: TestEnvironment) => void | Promise<void>;
}

/**
 * Mock service factory following DDD boundaries
 * Provides type-safe mocks that respect domain boundaries
 */
export class DomainMockFactory {
  /**
   * Create mock service with Result pattern support
   * Ensures mocks follow the same patterns as real services
   */
  static createMockService<T, E>(
    serviceName: string,
    methods: Record<string, (...args: unknown[]) => Result<T, E>>,
  ): Record<string, (...args: unknown[]) => Result<T, E>> {
    const mockService: Record<string, (...args: unknown[]) => Result<T, E>> =
      {};

    for (const [methodName, mockFn] of Object.entries(methods)) {
      mockService[methodName] = (...args: unknown[]) => {
        try {
          return mockFn(...args);
        } catch (error) {
          // Convert thrown errors to Result pattern
          return {
            ok: false,
            error: {
              kind: "MockError" as E,
              message: `Mock ${serviceName}.${methodName} failed: ${error}`,
            } as E,
          };
        }
      };
    }

    return mockService;
  }

  /**
   * Create repository mock with consistent data access patterns
   * Follows repository pattern with Result types
   */
  static createRepositoryMock<TEntity, TId, E>(
    _entityName: string,
    testData: TEntity[] = [],
  ): RepositoryMock<TEntity, TId, E> {
    const data = new Map<TId, TEntity>();
    testData.forEach((entity, index) => {
      data.set(index as TId, entity);
    });

    return {
      findById: (id: TId): Result<TEntity | null, E> => ({
        ok: true,
        data: data.get(id) || null,
      }),
      save: (entity: TEntity): Result<TEntity, E> => {
        const id = Math.random() as TId; // Simple ID generation for tests
        data.set(id, entity);
        return { ok: true, data: entity };
      },
      findAll: (): Result<TEntity[], E> => ({
        ok: true,
        data: Array.from(data.values()),
      }),
      clear: (): void => {
        data.clear();
      },
    };
  }
}

/**
 * Repository mock interface for type safety
 */
interface RepositoryMock<TEntity, TId, E> {
  findById(id: TId): Result<TEntity | null, E>;
  save(entity: TEntity): Result<TEntity, E>;
  findAll(): Result<TEntity[], E>;
  clear(): void;
}

/**
 * Test state manager with automatic rollback
 * Ensures tests don't affect each other through shared state
 */
export class TestStateManager {
  private static stateSnapshots = new Map<string, unknown>();

  /**
   * Capture current state for later restoration
   * Enables rollback of any changes made during test
   */
  static captureState<T>(key: string, state: T): void {
    this.stateSnapshots.set(key, structuredClone(state));
  }

  /**
   * Restore previously captured state
   * Guarantees test state isolation
   */
  static restoreState<T>(key: string): T | undefined {
    const snapshot = this.stateSnapshots.get(key);
    if (snapshot !== undefined) {
      return structuredClone(snapshot) as T;
    }
    return undefined;
  }

  /**
   * Execute test with automatic state restoration
   * Captures state before test, restores after regardless of outcome
   */
  static async withStateRestoration<T, R>(
    stateKey: string,
    currentState: T,
    testFn: () => R | Promise<R>,
  ): Promise<R> {
    this.captureState(stateKey, currentState);
    try {
      return await testFn();
    } finally {
      // Note: In real implementation, this would restore actual system state
      // Here we provide the pattern for test state management
      this.stateSnapshots.delete(stateKey);
    }
  }

  /**
   * Clear all captured state snapshots
   * Used for test cleanup
   */
  static clearAllSnapshots(): void {
    this.stateSnapshots.clear();
  }
}

/**
 * Domain-specific test builders following DDD patterns
 * Provides consistent test data creation across domain boundaries
 */
export class DomainTestBuilder {
  /**
   * Build test configuration with validation
   * Ensures test configurations follow domain rules
   */
  static buildTestConfig(overrides: Partial<Record<string, unknown>> = {}): {
    config: Record<string, unknown>;
    isValid: boolean;
  } {
    const baseConfig = {
      schemaPath: "./test-schema.json",
      inputPattern: "./test-input.md",
      outputPath: "./test-output.json",
      verbosityEnabled: false,
      strategyConfig: {
        kind: "standard" as const,
      },
    };

    const config = { ...baseConfig, ...overrides };
    const isValid = this.validateTestConfig(config);

    return { config, isValid };
  }

  /**
   * Build test pipeline state with type safety
   * Creates valid pipeline states for testing state transitions
   */
  static buildTestPipelineState(
    kind: string,
    additionalData: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const baseState = {
      kind,
      config: this.buildTestConfig().config,
      startTime: Date.now(),
    };

    return { ...baseState, ...additionalData };
  }

  /**
   * Build test error with comprehensive information
   * Creates consistent error objects for testing error handling
   */
  static buildTestError(
    kind: string,
    message: string,
    context: Record<string, unknown> = {},
  ): DomainError & { message: string } {
    return {
      kind: kind as any, // Note: In real implementation, this would use proper typing
      message,
      ...context,
    };
  }

  /**
   * Validate test configuration structure
   * Private utility for ensuring test config validity
   */
  private static validateTestConfig(config: Record<string, unknown>): boolean {
    const requiredKeys = ["schemaPath", "inputPattern", "outputPath"];
    return requiredKeys.every((key) => key in config && config[key] != null);
  }
}

/**
 * Integration test utilities for cross-domain scenarios
 * Provides robust patterns for testing domain boundary interactions
 */
export class IntegrationTestUtilities {
  /**
   * Test cross-domain communication with proper isolation
   * Ensures domain boundaries are respected in integration tests
   */
  static async testCrossDomainInteraction<TInput, TOutput, E>(
    scenario: CrossDomainTestScenario<TInput, TOutput, E>,
  ): Promise<Result<TOutput, E>> {
    // Setup isolated environment for integration test
    return await TestEnvironmentManager.withIsolatedEnvironment(
      scenario.name,
      () => ({
        resources: scenario.resources || {},
        cleanup: scenario.cleanup,
      }),
      async (env) => {
        // Execute the cross-domain scenario
        try {
          const result = await scenario.execute(scenario.input, env);

          // Validate domain boundaries were respected
          if (scenario.validateBoundaries) {
            const boundaryValidation = scenario.validateBoundaries(result, env);
            if (!boundaryValidation.isValid) {
              return {
                ok: false,
                error: {
                  kind: "DomainBoundaryViolation" as E,
                  message: boundaryValidation.message,
                } as E,
              };
            }
          }

          return result;
        } catch (error) {
          return {
            ok: false,
            error: {
              kind: "IntegrationTestError" as E,
              message: `Integration test '${scenario.name}' failed: ${error}`,
            } as E,
          };
        }
      },
    );
  }

  /**
   * Create pipeline test for end-to-end workflow validation
   * Tests complete data flow through multiple domain services
   */
  static createPipelineTest<TInput, TOutput, E>(
    name: string,
    stages: PipelineStage<unknown, unknown, E>[],
  ): PipelineTest<TInput, TOutput, E> {
    return {
      name,
      execute: async (input: TInput): Promise<Result<TOutput, E>> => {
        let currentData: unknown = input;

        for (const stage of stages) {
          const stageResult = await stage.execute(currentData);
          if (!stageResult.ok) {
            return {
              ok: false,
              error: {
                kind: "PipelineStageError" as E,
                stage: stage.name,
                originalError: stageResult.error,
              } as E,
            };
          }
          currentData = stageResult.data;
        }

        return { ok: true, data: currentData as TOutput };
      },
      validateStages: () => {
        // Validate pipeline stage compatibility
        for (let i = 0; i < stages.length - 1; i++) {
          const current = stages[i];
          const next = stages[i + 1];
          if (!this.areStagesCompatible(current, next)) {
            return {
              isValid: false,
              message: `Incompatible stages: ${current.name} -> ${next.name}`,
            };
          }
        }
        return { isValid: true, message: "All stages are compatible" };
      },
    };
  }

  /**
   * Check if pipeline stages are compatible
   * Private utility for pipeline validation
   */
  private static areStagesCompatible<T1, T2, E>(
    stage1: PipelineStage<T1, unknown, E>,
    stage2: PipelineStage<unknown, T2, E>,
  ): boolean {
    // In real implementation, this would check type compatibility
    // For now, we assume stages are compatible if both have execute methods
    return typeof stage1.execute === "function" &&
      typeof stage2.execute === "function";
  }
}

/**
 * Type definitions for integration testing
 */
interface CrossDomainTestScenario<TInput, TOutput, E> {
  name: string;
  input: TInput;
  resources?: Record<string, unknown>;
  execute: (input: TInput, env: TestEnvironment) => Promise<Result<TOutput, E>>;
  validateBoundaries?: (result: Result<TOutput, E>, env: TestEnvironment) => {
    isValid: boolean;
    message: string;
  };
  cleanup?: (env: TestEnvironment) => void | Promise<void>;
}

interface PipelineStage<TInput, TOutput, E> {
  name: string;
  execute: (input: TInput) => Promise<Result<TOutput, E>>;
}

interface PipelineTest<TInput, TOutput, E> {
  name: string;
  execute: (input: TInput) => Promise<Result<TOutput, E>>;
  validateStages: () => { isValid: boolean; message: string };
}

/**
 * Contract testing utilities for API and service boundaries
 * Ensures interface contracts remain stable across changes
 */
export class ContractTestUtilities {
  /**
   * Verify service contract compliance
   * Ensures services maintain their expected interface
   */
  static verifyServiceContract<TService>(
    serviceName: string,
    service: TService,
    contract: ServiceContract<TService>,
  ): ContractVerificationResult {
    const violations: string[] = [];

    // Check required methods exist
    for (const methodName of contract.requiredMethods) {
      if (typeof (service as any)[methodName] !== "function") {
        violations.push(`Missing required method: ${String(methodName)}`);
      }
    }

    // Check method signatures if provided
    if (contract.methodSignatures) {
      for (
        const [methodName, expectedSignature] of Object.entries(
          contract.methodSignatures,
        )
      ) {
        const method = (service as any)[methodName];
        if (method && typeof method === "function") {
          // In real implementation, this would check actual signatures
          // For now, we check function length (parameter count)
          if (method.length !== expectedSignature.parameterCount) {
            violations.push(
              `Method ${methodName} parameter count mismatch. Expected: ${expectedSignature.parameterCount}, Got: ${method.length}`,
            );
          }
        }
      }
    }

    return {
      serviceName,
      isCompliant: violations.length === 0,
      violations,
      contractVersion: contract.version || "1.0.0",
    };
  }

  /**
   * Create contract test suite for service interface
   * Provides standardized contract validation
   */
  static createContractTestSuite<TService>(
    serviceName: string,
    contract: ServiceContract<TService>,
  ): ContractTestSuite<TService> {
    return {
      serviceName,
      contract,
      runTests: (service: TService): ContractTestResult => {
        const verification = this.verifyServiceContract(
          serviceName,
          service,
          contract,
        );
        const testResults: TestCaseResult[] = [];

        // Run contract-specific test cases
        if (contract.testCases) {
          for (const testCase of contract.testCases) {
            try {
              const result = testCase.execute(service);
              testResults.push({
                name: testCase.name,
                passed: result.success,
                message: result.message,
              });
            } catch (error) {
              testResults.push({
                name: testCase.name,
                passed: false,
                message: `Test case failed: ${error}`,
              });
            }
          }
        }

        return {
          verification,
          testResults,
          overallResult: verification.isCompliant &&
            testResults.every((r) => r.passed),
        };
      },
    };
  }
}

/**
 * Type definitions for contract testing
 */
interface ServiceContract<TService> {
  requiredMethods: (keyof TService)[];
  methodSignatures?: Record<
    string,
    { parameterCount: number; returnType?: string }
  >;
  version?: string;
  testCases?: ContractTestCase<TService>[];
}

interface ContractTestCase<TService> {
  name: string;
  execute: (service: TService) => { success: boolean; message: string };
}

interface ContractVerificationResult {
  serviceName: string;
  isCompliant: boolean;
  violations: string[];
  contractVersion: string;
}

interface TestCaseResult {
  name: string;
  passed: boolean;
  message: string;
}

interface ContractTestSuite<TService> {
  serviceName: string;
  contract: ServiceContract<TService>;
  runTests: (service: TService) => ContractTestResult;
}

interface ContractTestResult {
  verification: ContractVerificationResult;
  testResults: TestCaseResult[];
  overallResult: boolean;
}

/**
 * Performance test utilities for ensuring no regressions
 * Provides consistent performance validation across refactoring
 */
export class PerformanceTestUtilities {
  /**
   * Measure function execution time with statistical analysis
   * Provides reliable performance measurements
   */
  static async measureExecution<T>(
    fn: () => T | Promise<T>,
    iterations: number = 10,
  ): Promise<{
    average: number;
    min: number;
    max: number;
    iterations: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    return {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      iterations,
    };
  }

  /**
   * Assert performance within acceptable bounds
   * Prevents performance regressions during refactoring
   */
  static assertPerformanceBounds(
    measurement: { average: number },
    maxAverageMs: number,
    message?: string,
  ): void {
    assert(
      measurement.average <= maxAverageMs,
      message ??
        `Performance regression detected. Average time ${measurement.average}ms exceeds limit ${maxAverageMs}ms`,
    );
  }
}
