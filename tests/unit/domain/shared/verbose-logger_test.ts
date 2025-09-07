/**
 * Tests for VerboseLogger
 *
 * Tests conditional logging functionality that respects verbose mode settings
 * following the Totality principle with safe environment variable handling.
 */

import { assertEquals } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import type { Logger } from "../../../../src/domain/shared/logger.ts";
import { VerboseLogger } from "../../../../src/domain/shared/verbose-logger.ts";
import { StructuredLogger } from "../../../../src/domain/shared/logger.ts";
import { DependencyContainer } from "../../../../src/infrastructure/services/dependency-container.ts";
import { EnvironmentConfig } from "../../../../src/domain/config/environment-config.ts";
import type { EnvironmentRepository } from "../../../../src/domain/repositories/file-system-repository.ts";

// Mock logger that captures calls for testing
class MockLogger implements Logger {
  logs: Array<{ level: string; message: string; data?: unknown }> = [];

  info(message: string, data?: unknown): void {
    this.logs.push({ level: "info", message, data });
  }

  warn(message: string, data?: unknown): void {
    this.logs.push({ level: "warn", message, data });
  }

  error(message: string, data?: unknown): void {
    this.logs.push({ level: "error", message, data });
  }

  debug(message: string, data?: unknown): void {
    this.logs.push({ level: "debug", message, data });
  }

  fatal(message: string, data?: unknown): void {
    this.logs.push({ level: "fatal", message, data });
  }

  trace(message: string, data?: unknown): void {
    this.logs.push({ level: "trace", message, data });
  }

  clear(): void {
    this.logs = [];
  }
}

// Mock environment repository for testing
class MockEnvironmentRepository implements EnvironmentRepository {
  private env = new Map<string, string>();

  get(key: string): string | undefined {
    return this.env.get(key);
  }

  getOrDefault(key: string, defaultValue: string): string {
    return this.env.get(key) || defaultValue;
  }

  getCurrentDirectory(): string {
    return "/test";
  }

  set(key: string, value: string): void {
    this.env.set(key, value);
  }

  delete(key: string): void {
    this.env.delete(key);
  }

  clear(): void {
    this.env.clear();
  }
}

// Helper function to setup environment and clear cache
function setupEnvironment(value?: string): () => void {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");

  // Reset the EnvironmentConfig singleton to ensure clean state
  EnvironmentConfig.resetSingleton();

  const mockEnvRepo = new MockEnvironmentRepository();
  if (value !== undefined) {
    mockEnvRepo.set("FRONTMATTER_VERBOSE_MODE", value);
  }

  DependencyContainer.getInstance().setEnvironmentRepository(mockEnvRepo);

  // Return cleanup function
  return () => {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
    DependencyContainer.getInstance().reset();
    EnvironmentConfig.resetSingleton();
  };
}

Deno.test("VerboseLogger - constructor detects verbose mode from environment", () => {
  // Test verbose mode enabled
  let cleanup = setupEnvironment("true");
  try {
    const verboseLogger = new VerboseLogger("test-service");
    assertEquals(verboseLogger.enabled, true);
  } finally {
    cleanup();
  }

  // Test verbose mode disabled (explicit false)
  cleanup = setupEnvironment("false");
  try {
    const nonVerboseLogger = new VerboseLogger("test-service");
    assertEquals(nonVerboseLogger.enabled, false);
  } finally {
    cleanup();
  }

  // Test verbose mode disabled (unset)
  cleanup = setupEnvironment();
  try {
    const defaultLogger = new VerboseLogger("test-service");
    assertEquals(defaultLogger.enabled, false);
  } finally {
    cleanup();
  }

  // Test verbose mode disabled (other value)
  cleanup = setupEnvironment("yes");
  try {
    const otherValueLogger = new VerboseLogger("test-service");
    assertEquals(otherValueLogger.enabled, false);
  } finally {
    cleanup();
  }
});

Deno.test("VerboseLogger - info method logs when verbose mode enabled", () => {
  const cleanup = setupEnvironment("true");

  // Create a mock logger and stub getServiceLogger
  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const verboseLogger = new VerboseLogger("test-service");
    const testMessage = "Test info message";
    const testData = { key: "value", count: 42 };

    verboseLogger.info(testMessage, testData);

    // Verify that info was called with correct parameters
    assertEquals(mockLogger.logs.length, 1);
    assertEquals(mockLogger.logs[0].level, "info");
    assertEquals(mockLogger.logs[0].message, testMessage);
    assertEquals(mockLogger.logs[0].data, testData);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - info method does not log when verbose mode disabled", () => {
  const cleanup = setupEnvironment("false");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const verboseLogger = new VerboseLogger("test-service");
    verboseLogger.info("Test message", { data: "test" });

    // Verify that nothing was logged
    assertEquals(mockLogger.logs.length, 0);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - warn method logs when verbose mode enabled", () => {
  const cleanup = setupEnvironment("true");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const verboseLogger = new VerboseLogger("test-service");
    const testMessage = "Test warning message";
    const testData = { warning: "critical", level: 5 };

    verboseLogger.warn(testMessage, testData);

    // Verify that warn was called with correct parameters
    assertEquals(mockLogger.logs.length, 1);
    assertEquals(mockLogger.logs[0].level, "warn");
    assertEquals(mockLogger.logs[0].message, testMessage);
    assertEquals(mockLogger.logs[0].data, testData);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - warn method does not log when verbose mode disabled", () => {
  const cleanup = setupEnvironment(); // Unset environment

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const verboseLogger = new VerboseLogger("test-service");
    verboseLogger.warn("Warning message", { level: "high" });

    // Verify that nothing was logged
    assertEquals(mockLogger.logs.length, 0);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - error method logs when verbose mode enabled", () => {
  const cleanup = setupEnvironment("true");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const verboseLogger = new VerboseLogger("test-service");
    const testMessage = "Test error message";
    const testData = { error: "fatal", code: 500 };

    verboseLogger.error(testMessage, testData);

    // Verify that error was called with correct parameters
    assertEquals(mockLogger.logs.length, 1);
    assertEquals(mockLogger.logs[0].level, "error");
    assertEquals(mockLogger.logs[0].message, testMessage);
    assertEquals(mockLogger.logs[0].data, testData);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - error method does not log when verbose mode disabled", () => {
  const cleanup = setupEnvironment("false");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const verboseLogger = new VerboseLogger("test-service");
    verboseLogger.error("Error message", { code: 404 });

    // Verify that nothing was logged
    assertEquals(mockLogger.logs.length, 0);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - enabled property reflects verbose mode state", () => {
  // Test enabled when verbose mode is true
  let cleanup = setupEnvironment("true");
  try {
    const enabledLogger = new VerboseLogger("test-service");
    assertEquals(enabledLogger.enabled, true);
  } finally {
    cleanup();
  }

  // Test disabled when verbose mode is false
  cleanup = setupEnvironment("false");
  try {
    const disabledLogger = new VerboseLogger("test-service");
    assertEquals(disabledLogger.enabled, false);
  } finally {
    cleanup();
  }

  // Test disabled when verbose mode is not set
  cleanup = setupEnvironment();
  try {
    const defaultLogger = new VerboseLogger("test-service");
    assertEquals(defaultLogger.enabled, false);
  } finally {
    cleanup();
  }

  // Test disabled with arbitrary value
  cleanup = setupEnvironment("debug");
  try {
    const debugLogger = new VerboseLogger("test-service");
    assertEquals(debugLogger.enabled, false);
  } finally {
    cleanup();
  }
});

Deno.test("VerboseLogger - createScoped creates logger with scoped service name", () => {
  const cleanup = setupEnvironment("true");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const parentLogger = new VerboseLogger("parent");
    const scopedLogger = parentLogger.createScoped("child");

    scopedLogger.info("Test message");

    // Verify that the scoped service name was used
    assertEquals(getServiceLoggerStub.calls.length, 1);
    assertEquals(getServiceLoggerStub.calls[0].args[0], "parent-child");
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - createScoped preserves disabled state", () => {
  const cleanup = setupEnvironment("false");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const parentLogger = new VerboseLogger("parent");
    const scopedLogger = parentLogger.createScoped("child");

    assertEquals(scopedLogger.enabled, false);

    scopedLogger.info("Should not log");

    // Verify nothing was logged
    assertEquals(mockLogger.logs.length, 0);
    assertEquals(getServiceLoggerStub.calls.length, 0);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - multiple scoping levels work correctly", () => {
  const cleanup = setupEnvironment("true");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const rootLogger = new VerboseLogger("root");
    const level1Logger = rootLogger.createScoped("level1");
    const level2Logger = level1Logger.createScoped("level2");

    level2Logger.info("Deep message");

    // Verify the fully scoped service name
    assertEquals(getServiceLoggerStub.calls.length, 1);
    assertEquals(getServiceLoggerStub.calls[0].args[0], "root-level1-level2");
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - handles undefined and null data correctly", () => {
  const cleanup = setupEnvironment("true");

  const mockLogger = new MockLogger();
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    () => mockLogger,
  );

  try {
    const verboseLogger = new VerboseLogger("test-service");

    // Test with undefined data
    verboseLogger.info("Message without data");
    assertEquals(mockLogger.logs.length, 1);
    assertEquals(mockLogger.logs[0].data, undefined);

    mockLogger.clear();

    // Test with null data (TypeScript would normally prevent this)
    // deno-lint-ignore no-explicit-any
    verboseLogger.warn("Message with null", null as any);
    assertEquals(mockLogger.logs.length, 1);
    assertEquals(mockLogger.logs[0].data, null);

    mockLogger.clear();

    // Test with empty object
    verboseLogger.error("Message with empty object", {});
    assertEquals(mockLogger.logs.length, 1);
    assertEquals(mockLogger.logs[0].data, {});
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - service name correctly passed to StructuredLogger", () => {
  const cleanup = setupEnvironment("true");

  const mockLogger = new MockLogger();
  let capturedServiceName: string | undefined;
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    (serviceName: string) => {
      capturedServiceName = serviceName;
      return mockLogger;
    },
  );

  try {
    const serviceName = "my-special-service";
    const verboseLogger = new VerboseLogger(serviceName);

    verboseLogger.info("Test");

    assertEquals(capturedServiceName, serviceName);
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});

Deno.test("VerboseLogger - scoped service name correctly formatted", () => {
  const cleanup = setupEnvironment("true");

  const mockLogger = new MockLogger();
  let capturedServiceName: string | undefined;
  const getServiceLoggerStub = stub(
    StructuredLogger,
    "getServiceLogger",
    (serviceName: string) => {
      capturedServiceName = serviceName;
      return mockLogger;
    },
  );

  try {
    const verboseLogger = new VerboseLogger("base");
    const scopedLogger = verboseLogger.createScoped("scoped");

    scopedLogger.warn("Warning");

    assertEquals(capturedServiceName, "base-scoped");
  } finally {
    getServiceLoggerStub.restore();
    cleanup();
  }
});
