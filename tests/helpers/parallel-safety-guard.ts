/**
 * Parallel Execution Safety Guard
 *
 * Ensures tests run safely in parallel with complete isolation and environment independence.
 */

import { crypto } from "jsr:@std/crypto";
import { join } from "@std/path";

export interface TestContext {
  readonly id: string;
  readonly workDir: string;
  readonly tempFiles: string[];
  addTempFile(path: string): void;
  cleanup(): Promise<void>;
}

class IsolatedTestContext implements TestContext {
  readonly id: string;
  readonly workDir: string;
  readonly tempFiles: string[] = [];
  private readonly cleanupCallbacks: (() => Promise<void>)[] = [];

  constructor() {
    this.id = crypto.randomUUID();
    this.workDir = join(Deno.makeTempDirSync(), `test-${this.id}`);
  }

  addTempFile(path: string): void {
    this.tempFiles.push(path);
  }

  addCleanupCallback(callback: () => Promise<void>): void {
    this.cleanupCallbacks.push(callback);
  }

  async cleanup(): Promise<void> {
    // Clean up temp files
    for (const file of this.tempFiles) {
      try {
        await Deno.remove(file, { recursive: true });
      } catch {
        // File might not exist or already be deleted
      }
    }

    // Run custom cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        console.warn(`Cleanup callback failed: ${error}`);
      }
    }

    // Clean up work directory
    try {
      await Deno.remove(this.workDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  }
}

/**
 * Global Test State Manager
 * Prevents tests from interfering with each other through shared state
 */
class GlobalStateManager {
  private static readonly activeTests = new Set<string>();
  private static readonly testStates = new Map<string, unknown>();

  static registerTest(testId: string): void {
    if (this.activeTests.has(testId)) {
      throw new Error(`Test ID collision: ${testId}`);
    }
    this.activeTests.add(testId);
    this.testStates.set(testId, {});
  }

  static unregisterTest(testId: string): void {
    this.activeTests.delete(testId);
    this.testStates.delete(testId);
  }

  static getTestState<T = unknown>(testId: string): T {
    return (this.testStates.get(testId) as T) || ({} as T);
  }

  static setTestState<T>(testId: string, state: T): void {
    this.testStates.set(testId, state);
  }

  static getActiveTestCount(): number {
    return this.activeTests.size;
  }
}

/**
 * Environment Isolation Utilities
 */
export class EnvironmentIsolation {
  /**
   * Creates an isolated test environment with cleanup
   */
  static async withIsolation<T>(
    _testName: string,
    testFn: (ctx: TestContext) => Promise<T>,
  ): Promise<T> {
    const context = new IsolatedTestContext();

    try {
      GlobalStateManager.registerTest(context.id);
      return await testFn(context);
    } finally {
      GlobalStateManager.unregisterTest(context.id);
      await context.cleanup();
    }
  }

  /**
   * Creates a unique temporary directory for the test
   */
  static createTempDir(ctx: TestContext, suffix = ""): string {
    const tempDir = join(ctx.workDir, `temp-${suffix || crypto.randomUUID()}`);
    Deno.mkdirSync(tempDir, { recursive: true });
    ctx.addTempFile(tempDir);
    return tempDir;
  }

  /**
   * Creates a unique temporary file for the test
   */
  static async createTempFile(
    ctx: TestContext,
    content: string,
    extension = ".tmp",
  ): Promise<string> {
    const tempFile = join(
      ctx.workDir,
      `file-${crypto.randomUUID()}${extension}`,
    );
    await Deno.writeTextFile(tempFile, content);
    ctx.addTempFile(tempFile);
    return tempFile;
  }

  /**
   * Mocks environment variables for the test scope
   */
  static withEnvironmentVariables<T>(
    variables: Record<string, string>,
    testFn: () => Promise<T>,
  ): Promise<T> {
    const originalEnv: Record<string, string | undefined> = {};

    // Store original values
    for (const key of Object.keys(variables)) {
      originalEnv[key] = Deno.env.get(key);
    }

    try {
      // Set test variables
      for (const [key, value] of Object.entries(variables)) {
        Deno.env.set(key, value);
      }

      return testFn();
    } finally {
      // Restore original values
      for (const [key, originalValue] of Object.entries(originalEnv)) {
        if (originalValue === undefined) {
          Deno.env.delete(key);
        } else {
          Deno.env.set(key, originalValue);
        }
      }
    }
  }
}

/**
 * Resource Management for Tests
 */
export class ResourceManager {
  private static readonly allocatedResources = new Map<string, Set<string>>();

  /**
   * Allocates a unique resource identifier for a test
   */
  static allocateResource(testId: string, resourceType: string): string {
    const resourceId = `${resourceType}-${crypto.randomUUID()}`;

    if (!this.allocatedResources.has(testId)) {
      this.allocatedResources.set(testId, new Set());
    }

    this.allocatedResources.get(testId)!.add(resourceId);
    return resourceId;
  }

  /**
   * Releases all resources allocated for a test
   */
  static releaseAllResources(testId: string): void {
    this.allocatedResources.delete(testId);
  }

  /**
   * Gets all resources allocated for a test
   */
  static getTestResources(testId: string): string[] {
    return Array.from(this.allocatedResources.get(testId) || []);
  }

  /**
   * Checks for resource conflicts between tests
   */
  static checkResourceConflicts(): string[] {
    const allResources: string[] = [];
    const conflicts: string[] = [];

    for (const resources of this.allocatedResources.values()) {
      for (const resource of resources) {
        if (allResources.includes(resource)) {
          conflicts.push(resource);
        } else {
          allResources.push(resource);
        }
      }
    }

    return conflicts;
  }
}

/**
 * Test Execution Monitor
 */
export class TestExecutionMonitor {
  private static readonly executionTimes = new Map<string, number>();
  private static readonly memoryUsage = new Map<string, number>();

  static startMonitoring(testId: string): void {
    this.executionTimes.set(testId, performance.now());
    this.memoryUsage.set(testId, Deno.memoryUsage().heapUsed);
  }

  static endMonitoring(testId: string): {
    executionTimeMs: number;
    memoryDeltaBytes: number;
  } {
    const endTime = performance.now();
    const endMemory = Deno.memoryUsage().heapUsed;

    const startTime = this.executionTimes.get(testId) || endTime;
    const startMemory = this.memoryUsage.get(testId) || endMemory;

    this.executionTimes.delete(testId);
    this.memoryUsage.delete(testId);

    return {
      executionTimeMs: endTime - startTime,
      memoryDeltaBytes: endMemory - startMemory,
    };
  }

  static getPerformanceReport(): {
    averageExecutionTimeMs: number;
    maxMemoryDeltaBytes: number;
    activeTests: number;
  } {
    const executionTimes = Array.from(this.executionTimes.values());
    const memoryDeltas = Array.from(this.memoryUsage.values());

    return {
      averageExecutionTimeMs: executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0,
      maxMemoryDeltaBytes: Math.max(...memoryDeltas, 0),
      activeTests: GlobalStateManager.getActiveTestCount(),
    };
  }
}

/**
 * High-Level Parallel-Safe Test Runner
 */
export class ParallelSafeTestRunner {
  /**
   * Runs a test with complete isolation and monitoring
   */
  static async runIsolatedTest<T>(
    testName: string,
    testFn: (ctx: TestContext) => Promise<T>,
    options: {
      maxExecutionTimeMs?: number;
      maxMemoryDeltaMB?: number;
      environmentVariables?: Record<string, string>;
    } = {},
  ): Promise<T> {
    return await EnvironmentIsolation.withIsolation(testName, async (ctx) => {
      TestExecutionMonitor.startMonitoring(ctx.id);

      try {
        const testExecution = options.environmentVariables
          ? () =>
            EnvironmentIsolation.withEnvironmentVariables(
              options.environmentVariables!,
              () => testFn(ctx),
            )
          : () => testFn(ctx);

        const result = await testExecution();

        const metrics = TestExecutionMonitor.endMonitoring(ctx.id);

        // Check performance constraints
        if (
          options.maxExecutionTimeMs &&
          metrics.executionTimeMs > options.maxExecutionTimeMs
        ) {
          throw new Error(
            `Test '${testName}' took ${
              metrics.executionTimeMs.toFixed(2)
            }ms, ` +
              `exceeding limit of ${options.maxExecutionTimeMs}ms`,
          );
        }

        const maxMemoryBytes = (options.maxMemoryDeltaMB || 50) * 1024 * 1024;
        if (metrics.memoryDeltaBytes > maxMemoryBytes) {
          throw new Error(
            `Test '${testName}' used ${
              (metrics.memoryDeltaBytes / 1024 / 1024).toFixed(2)
            }MB, ` +
              `exceeding limit of ${options.maxMemoryDeltaMB || 50}MB`,
          );
        }

        return result;
      } catch (error) {
        TestExecutionMonitor.endMonitoring(ctx.id);
        throw error;
      }
    });
  }

  /**
   * Runs multiple tests in parallel with conflict detection
   */
  static async runParallelTests<T>(
    tests: Array<{
      name: string;
      test: (ctx: TestContext) => Promise<T>;
      options?: { maxExecutionTimeMs?: number; maxMemoryDeltaMB?: number };
    }>,
  ): Promise<T[]> {
    const promises = tests.map(({ name, test, options }) =>
      this.runIsolatedTest(name, test, options || {})
    );

    return await Promise.all(promises);
  }
}
