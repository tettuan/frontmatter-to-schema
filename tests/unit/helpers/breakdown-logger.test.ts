/**
 * Comprehensive tests for BreakdownLogger
 * Testing structured logging utility for test debugging
 * Following AAA pattern and Totality principles
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertGreater,
  type assertInstanceOf as _assertInstanceOf,
  assertStringIncludes,
} from "jsr:@std/assert";
import {
  BreakdownLogger,
  getBreakdownLogger,
  type LogContext,
  type LogEntry as _LogEntry,
  logTestExecution,
  type TestScopeLogger,
} from "../../../tests/helpers/breakdown-logger.ts";

// Test helpers
function createTestContext(
  testName: string,
  phase: LogContext["phase"] = "arrange",
  domain?: string,
): LogContext {
  return {
    testName,
    phase,
    domain,
  };
}

function captureConsoleOutput(): {
  logs: string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const originalMethods = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.debug = (...args) => logs.push(`DEBUG: ${args.join(" ")}`);
  console.info = (...args) => logs.push(`INFO: ${args.join(" ")}`);
  console.warn = (...args) => logs.push(`WARN: ${args.join(" ")}`);
  console.error = (...args) => logs.push(`ERROR: ${args.join(" ")}`);

  return {
    logs,
    restore: () => {
      console.debug = originalMethods.debug;
      console.info = originalMethods.info;
      console.warn = originalMethods.warn;
      console.error = originalMethods.error;
    },
  };
}

Deno.test("BreakdownLogger - Singleton and Initialization", async (t) => {
  await t.step("getInstance returns singleton instance", () => {
    // Arrange & Act
    const instance1 = BreakdownLogger.getInstance();
    const instance2 = BreakdownLogger.getInstance();

    // Assert
    assertExists(instance1);
    assertExists(instance2);
    assertEquals(instance1, instance2);
    assert(typeof instance1.isEnabled === "function");
  });

  await t.step("getBreakdownLogger convenience function works", () => {
    // Arrange & Act
    const logger1 = getBreakdownLogger();
    const logger2 = BreakdownLogger.getInstance();

    // Assert
    assertExists(logger1);
    assertEquals(logger1, logger2);
  });

  await t.step("logger starts with disabled state by default", () => {
    // Arrange & Act
    const logger = BreakdownLogger.getInstance();

    // Assert
    assertFalse(logger.isEnabled());
  });

  await t.step("can manually enable logging", () => {
    // Arrange
    const logger = BreakdownLogger.getInstance();

    // Act
    logger.setEnabled(true);

    // Assert
    assert(logger.isEnabled());

    // Cleanup
    logger.setEnabled(false);
  });

  await t.step("entries start empty", () => {
    // Arrange & Act
    const logger = BreakdownLogger.getInstance();
    const entries = logger.getEntries();

    // Assert
    assertEquals(entries.length, 0);
  });
});

Deno.test("BreakdownLogger - Environment Variable Detection", async (t) => {
  await t.step("detects BREAKDOWN_LOG=true", () => {
    // Arrange
    const originalGet = Deno.env.get;
    Deno.env.get = (key: string) =>
      key === "BREAKDOWN_LOG" ? "true" : undefined;

    // Act - Force new instance by clearing static
    // deno-lint-ignore no-explicit-any
    (BreakdownLogger as any).instance = undefined;
    const logger = BreakdownLogger.getInstance();

    // Assert
    assert(logger.isEnabled());

    // Cleanup
    Deno.env.get = originalGet;
    logger.setEnabled(false);
  });

  await t.step("detects BREAKDOWN_LOG=false", () => {
    // Arrange
    const originalGet = Deno.env.get;
    Deno.env.get = (key: string) =>
      key === "BREAKDOWN_LOG" ? "false" : undefined;

    // Act - Force new instance
    // deno-lint-ignore no-explicit-any
    (BreakdownLogger as any).instance = undefined;
    const logger = BreakdownLogger.getInstance();

    // Assert
    assertFalse(logger.isEnabled());

    // Cleanup
    Deno.env.get = originalGet;
  });

  await t.step("handles environment access errors gracefully", () => {
    // Arrange
    const originalGet = Deno.env.get;
    Deno.env.get = () => {
      throw new Error("Permission denied");
    };

    // Act - Force new instance
    // deno-lint-ignore no-explicit-any
    (BreakdownLogger as any).instance = undefined;
    const logger = BreakdownLogger.getInstance();

    // Assert - Should default to disabled
    assertFalse(logger.isEnabled());

    // Cleanup
    Deno.env.get = originalGet;
  });
});

Deno.test("BreakdownLogger - Basic Logging", async (t) => {
  let logger: BreakdownLogger;
  let consoleCapture: { logs: string[]; restore: () => void };

  // Setup for all steps
  const setup = () => {
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
    consoleCapture = captureConsoleOutput();
  };

  const teardown = () => {
    consoleCapture.restore();
    logger.setEnabled(false);
    logger.clear();
  };

  await t.step("debug logging works", () => {
    // Arrange
    setup();
    const context = createTestContext("test-debug", "arrange");

    // Act
    logger.debug(context, "Debug message", { data: "test" });

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].level, "debug");
    assertEquals(entries[0].message, "Debug message");
    assertEquals(entries[0].context.testName, "test-debug");
    assertEquals(entries[0].data, { data: "test" });
    assertExists(entries[0].timestamp);

    // Check console output
    assertEquals(consoleCapture.logs.length, 1);
    assertStringIncludes(consoleCapture.logs[0], "DEBUG");
    assertStringIncludes(consoleCapture.logs[0], "Debug message");

    // Cleanup
    teardown();
  });

  await t.step("info logging works", () => {
    // Arrange
    setup();
    const context = createTestContext("test-info", "act");

    // Act
    logger.info(context, "Info message");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].level, "info");
    assertEquals(entries[0].message, "Info message");

    // Cleanup
    teardown();
  });

  await t.step("warn logging works", () => {
    // Arrange
    setup();
    const context = createTestContext("test-warn", "assert");

    // Act
    logger.warn(context, "Warning message");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].level, "warn");
    assertEquals(entries[0].message, "Warning message");

    // Cleanup
    teardown();
  });

  await t.step("error logging works", () => {
    // Arrange
    setup();
    const context = createTestContext("test-error", "cleanup");

    // Act
    logger.error(context, "Error message");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].level, "error");
    assertEquals(entries[0].message, "Error message");

    // Cleanup
    teardown();
  });

  await t.step("logging disabled when isEnabled() is false", () => {
    // Arrange
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(false);
    consoleCapture = captureConsoleOutput();
    const context = createTestContext("test-disabled", "arrange");

    // Act
    logger.debug(context, "Should not log");
    logger.info(context, "Should not log");
    logger.warn(context, "Should not log");
    logger.error(context, "Should not log");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 0);
    assertEquals(consoleCapture.logs.length, 0);

    // Cleanup
    consoleCapture.restore();
  });
});

Deno.test("BreakdownLogger - Timer Functionality", async (t) => {
  let logger: BreakdownLogger;

  const setup = () => {
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
  };

  const teardown = () => {
    logger.setEnabled(false);
    logger.clear();
  };

  await t.step("startTimer and endTimer work correctly", () => {
    // Arrange
    setup();

    // Act
    logger.startTimer("test-timer");

    // Small delay to ensure measurable time
    const start = performance.now();
    while (performance.now() - start < 1) {
      // Busy wait for 1ms
    }

    const duration = logger.endTimer("test-timer");

    // Assert
    assertExists(duration);
    assertGreater(duration!, 0);

    // Cleanup
    teardown();
  });

  await t.step("endTimer returns undefined for non-existent timer", () => {
    // Arrange
    setup();

    // Act
    const duration = logger.endTimer("non-existent");

    // Assert
    assertEquals(duration, undefined);

    // Cleanup
    teardown();
  });

  await t.step("timer functionality disabled when logging is disabled", () => {
    // Arrange
    logger = BreakdownLogger.getInstance();
    logger.setEnabled(false);

    // Act
    logger.startTimer("disabled-timer");
    const duration = logger.endTimer("disabled-timer");

    // Assert
    assertEquals(duration, undefined);
  });

  await t.step("logWithTiming works correctly", () => {
    // Arrange
    setup();
    const consoleCapture = captureConsoleOutput();
    const context = createTestContext("timing-test", "act");

    // Act
    logger.startTimer("timing-test");
    const start = performance.now();
    while (performance.now() - start < 1) {
      // Busy wait
    }
    logger.logWithTiming(context, "Timed operation", "timing-test", {
      operation: "test",
    });

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].level, "info");
    assertEquals(entries[0].message, "Timed operation");
    assertExists(entries[0].duration);
    assertGreater(entries[0].duration!, 0);
    assertEquals(entries[0].data, { operation: "test" });

    // Cleanup
    consoleCapture.restore();
    teardown();
  });

  await t.step("logWithTiming disabled when logging is disabled", () => {
    // Arrange
    logger = BreakdownLogger.getInstance();
    logger.setEnabled(false);
    const context = createTestContext("disabled-timing", "act");

    // Act
    logger.logWithTiming(context, "Should not log", "timer", {});

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 0);
  });
});

Deno.test("BreakdownLogger - Phase and Result Logging", async (t) => {
  let logger: BreakdownLogger;
  let consoleCapture: { logs: string[]; restore: () => void };

  const setup = () => {
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
    consoleCapture = captureConsoleOutput();
  };

  const teardown = () => {
    consoleCapture.restore();
    logger.setEnabled(false);
    logger.clear();
  };

  await t.step("logPhase works with default message", () => {
    // Arrange
    setup();

    // Act
    logger.logPhase("test-phase", "arrange");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.testName, "test-phase");
    assertEquals(entries[0].context.phase, "arrange");
    assertEquals(entries[0].message, "Starting arrange phase");

    // Cleanup
    teardown();
  });

  await t.step("logPhase works with custom message", () => {
    // Arrange
    setup();

    // Act
    logger.logPhase("test-phase", "act", "Custom phase message");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].message, "Custom phase message");

    // Cleanup
    teardown();
  });

  await t.step("logResult works with successful result", () => {
    // Arrange
    setup();
    const context = createTestContext("result-test", "assert");
    const successResult = { ok: true, data: { value: 42 } };

    // Act
    logger.logResult(context, successResult);

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].level, "info");
    assertEquals(entries[0].message, "Operation succeeded");
    assertEquals(entries[0].data, { data: { value: 42 } });

    // Cleanup
    teardown();
  });

  await t.step("logResult works with failed result", () => {
    // Arrange
    setup();
    const context = createTestContext("result-test", "assert");
    const failedResult = { ok: false, error: { message: "Test error" } };

    // Act
    logger.logResult(context, failedResult);

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].level, "error");
    assertEquals(entries[0].message, "Operation failed: Test error");
    assertEquals(entries[0].data, { error: { message: "Test error" } });

    // Cleanup
    teardown();
  });

  await t.step("logResult works with custom messages", () => {
    // Arrange
    setup();
    const context = createTestContext("result-test", "assert");
    const successResult = { ok: true, data: "success" };

    // Act
    logger.logResult(context, successResult, "Custom success message");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].message, "Custom success message");

    // Cleanup
    teardown();
  });

  await t.step(
    "phase and result logging disabled when logging is disabled",
    () => {
      // Arrange
      logger = BreakdownLogger.getInstance();
      logger.setEnabled(false);
      const context = createTestContext("disabled-test", "act");

      // Act
      logger.logPhase("test", "arrange");
      logger.logResult(context, { ok: true, data: {} });

      // Assert
      const entries = logger.getEntries();
      assertEquals(entries.length, 0);
    },
  );
});

Deno.test("BreakdownLogger - TestScopeLogger", async (t) => {
  let logger: BreakdownLogger;
  let scopedLogger: TestScopeLogger;
  let consoleCapture: { logs: string[]; restore: () => void };

  const setup = () => {
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
    consoleCapture = captureConsoleOutput();
    scopedLogger = logger.createTestScope("scoped-test", "test-domain");
  };

  const teardown = () => {
    consoleCapture.restore();
    logger.setEnabled(false);
    logger.clear();
  };

  await t.step("createTestScope returns TestScopeLogger", () => {
    // Arrange & Act
    logger = BreakdownLogger.getInstance();
    const scoped = logger.createTestScope("test", "domain");

    // Assert
    assertExists(scoped);
    assert(typeof scoped.arrange === "function");
  });

  await t.step("scoped arrange logging works", () => {
    // Arrange
    setup();

    // Act
    scopedLogger.arrange("Setting up test", { setup: "data" });

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.testName, "scoped-test");
    assertEquals(entries[0].context.phase, "arrange");
    assertEquals(entries[0].context.domain, "test-domain");
    assertEquals(entries[0].message, "Setting up test");
    assertEquals(entries[0].data, { setup: "data" });

    // Cleanup
    teardown();
  });

  await t.step("scoped act logging works", () => {
    // Arrange
    setup();

    // Act
    scopedLogger.act("Executing test action");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.phase, "act");
    assertEquals(entries[0].message, "Executing test action");

    // Cleanup
    teardown();
  });

  await t.step("scoped assert logging works", () => {
    // Arrange
    setup();

    // Act
    scopedLogger.assert("Checking results");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.phase, "assert");
    assertEquals(entries[0].message, "Checking results");

    // Cleanup
    teardown();
  });

  await t.step("scoped cleanup logging works", () => {
    // Arrange
    setup();

    // Act
    scopedLogger.cleanup("Cleaning up test");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.phase, "cleanup");
    assertEquals(entries[0].message, "Cleaning up test");

    // Cleanup
    teardown();
  });

  await t.step("scoped timer functionality works", () => {
    // Arrange
    setup();

    // Act
    scopedLogger.startTimer("operation");
    const start = performance.now();
    while (performance.now() - start < 1) {
      // Busy wait
    }
    scopedLogger.endTimer("operation", "Operation completed", {
      result: "success",
    });

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.testName, "scoped-test");
    assertEquals(entries[0].context.phase, "act");
    assertEquals(entries[0].message, "Operation completed");
    assertExists(entries[0].duration);
    assertGreater(entries[0].duration!, 0);
    assertEquals(entries[0].data, { result: "success" });

    // Cleanup
    teardown();
  });

  await t.step("scoped logResult works", () => {
    // Arrange
    setup();
    const result = { ok: true, data: { test: "success" } };

    // Act
    scopedLogger.logResult("assert", result, "Test passed");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.testName, "scoped-test");
    assertEquals(entries[0].context.phase, "assert");
    assertEquals(entries[0].message, "Test passed");
    assertEquals(entries[0].data, { data: { test: "success" } });

    // Cleanup
    teardown();
  });

  await t.step("scoped logger with no domain works", () => {
    // Arrange
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
    const noDomainScoped = logger.createTestScope("no-domain-test");

    // Act
    noDomainScoped.arrange("Test without domain");

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].context.testName, "no-domain-test");
    assertEquals(entries[0].context.domain, undefined);

    // Cleanup
    logger.setEnabled(false);
    logger.clear();
  });
});

Deno.test("BreakdownLogger - Utility Functions", async (t) => {
  let logger: BreakdownLogger;

  const setup = () => {
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
  };

  const teardown = () => {
    logger.setEnabled(false);
    logger.clear();
  };

  await t.step("clear removes all entries and timers", () => {
    // Arrange
    setup();
    const context = createTestContext("clear-test", "arrange");
    logger.info(context, "Test message");
    logger.startTimer("test-timer");

    // Verify entries exist
    assertEquals(logger.getEntries().length, 1);

    // Act
    logger.clear();

    // Assert
    assertEquals(logger.getEntries().length, 0);
    // Timer should also be cleared
    const duration = logger.endTimer("test-timer");
    assertEquals(duration, undefined);

    // Cleanup
    teardown();
  });

  await t.step("getEntries returns readonly array", () => {
    // Arrange
    setup();
    const context = createTestContext("readonly-test", "act");
    logger.info(context, "Test message 1");
    logger.info(context, "Test message 2");

    // Act
    const entries = logger.getEntries();

    // Assert
    assertEquals(entries.length, 2);
    assertEquals(entries[0].message, "Test message 1");
    assertEquals(entries[1].message, "Test message 2");

    // Cleanup
    teardown();
  });

  await t.step("exportToJson returns valid JSON", () => {
    // Arrange
    setup();
    const context = createTestContext("json-test", "assert", "test-domain");
    logger.info(context, "Test message", { data: "test" });

    // Act
    const jsonString = logger.exportToJson();
    const parsed = JSON.parse(jsonString);

    // Assert
    assert(Array.isArray(parsed));
    assertEquals(parsed.length, 1);
    assertEquals(parsed[0].message, "Test message");
    assertEquals(parsed[0].context.testName, "json-test");
    assertEquals(parsed[0].context.phase, "assert");
    assertEquals(parsed[0].context.domain, "test-domain");
    assertEquals(parsed[0].data.data, "test");
    assertExists(parsed[0].timestamp);

    // Cleanup
    teardown();
  });

  await t.step("exportToJson handles empty logs", () => {
    // Arrange
    setup();

    // Act
    const jsonString = logger.exportToJson();
    const parsed = JSON.parse(jsonString);

    // Assert
    assert(Array.isArray(parsed));
    assertEquals(parsed.length, 0);

    // Cleanup
    teardown();
  });
});

Deno.test("BreakdownLogger - Console Output Formatting", async (t) => {
  let logger: BreakdownLogger;
  let consoleCapture: { logs: string[]; restore: () => void };

  const setup = () => {
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
    consoleCapture = captureConsoleOutput();
  };

  const teardown = () => {
    consoleCapture.restore();
    logger.setEnabled(false);
    logger.clear();
  };

  await t.step("console output includes all required elements", () => {
    // Arrange
    setup();
    const context = createTestContext("format-test", "arrange", "test-domain");

    // Act
    logger.info(context, "Test message", { data: "test" });

    // Assert
    assertEquals(consoleCapture.logs.length, 1);
    const output = consoleCapture.logs[0];

    assertStringIncludes(output, "INFO");
    assertStringIncludes(output, "format-test");
    assertStringIncludes(output, "arrange");
    assertStringIncludes(output, "Test message");

    // Cleanup
    teardown();
  });

  await t.step("console output includes timing when available", () => {
    // Arrange
    setup();
    const context = createTestContext("timing-format-test", "act");

    // Act
    logger.startTimer("format-timer");
    const start = performance.now();
    while (performance.now() - start < 1) {
      // Busy wait
    }
    logger.logWithTiming(context, "Timed operation", "format-timer");

    // Assert
    assertEquals(consoleCapture.logs.length, 1);
    const output = consoleCapture.logs[0];

    assertStringIncludes(output, "Timed operation");
    assertStringIncludes(output, "ms)");

    // Cleanup
    teardown();
  });

  await t.step("different log levels use correct console methods", () => {
    // Arrange
    setup();
    const context = createTestContext("levels-test", "arrange");

    // Act
    logger.debug(context, "Debug");
    logger.info(context, "Info");
    logger.warn(context, "Warn");
    logger.error(context, "Error");

    // Assert
    assertEquals(consoleCapture.logs.length, 4);
    assertStringIncludes(consoleCapture.logs[0], "DEBUG");
    assertStringIncludes(consoleCapture.logs[1], "INFO");
    assertStringIncludes(consoleCapture.logs[2], "WARN");
    assertStringIncludes(consoleCapture.logs[3], "ERROR");

    // Cleanup
    teardown();
  });
});

Deno.test("BreakdownLogger - Decorator Function", async (t) => {
  await t.step("logTestExecution decorator exists and is callable", () => {
    // Arrange
    const target = {};
    const propertyKey = "testMethod";
    const descriptor: PropertyDescriptor = {
      // deno-lint-ignore require-await
      value: async () => "test result",
    };

    // Act
    const newDescriptor = logTestExecution(target, propertyKey, descriptor);

    // Assert
    assertExists(newDescriptor);
    assertExists(newDescriptor.value);
    assertEquals(typeof newDescriptor.value, "function");
  });

  await t.step(
    "decorator wraps method correctly when logging disabled",
    async () => {
      // Arrange
      const logger = BreakdownLogger.getInstance();
      logger.setEnabled(false);

      let called = false;
      const target = { constructor: { name: "TestClass" } };
      const propertyKey = "testMethod";
      const descriptor: PropertyDescriptor = {
        // deno-lint-ignore require-await
        value: async () => {
          called = true;
          return "original result";
        },
      };

      // Act
      const newDescriptor = logTestExecution(target, propertyKey, descriptor);
      const result = await newDescriptor.value();

      // Assert
      assert(called);
      assertEquals(result, "original result");
      assertEquals(logger.getEntries().length, 0);
    },
  );

  await t.step(
    "decorator wraps method correctly when logging enabled",
    async () => {
      // Arrange
      const logger = BreakdownLogger.getInstance();
      logger.clear();
      logger.setEnabled(true);

      let called = false;
      const target = { constructor: { name: "TestClass" } };
      const propertyKey = "testMethod";
      const descriptor: PropertyDescriptor = {
        // deno-lint-ignore require-await
        value: async () => {
          called = true;
          return "original result";
        },
      };

      // Act
      const newDescriptor = logTestExecution(target, propertyKey, descriptor);
      const result = await newDescriptor.value();

      // Assert
      assert(called);
      assertEquals(result, "original result");
      assertGreater(logger.getEntries().length, 0);

      // Cleanup
      logger.setEnabled(false);
      logger.clear();
    },
  );

  await t.step("decorator handles method errors correctly", async () => {
    // Arrange
    const logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);

    const testError = new Error("Test error");
    const target = { constructor: { name: "TestClass" } };
    const propertyKey = "errorMethod";
    const descriptor: PropertyDescriptor = {
      // deno-lint-ignore require-await
      value: async () => {
        throw testError;
      },
    };

    // Act & Assert
    const newDescriptor = logTestExecution(target, propertyKey, descriptor);

    try {
      await newDescriptor.value();
      assert(false, "Should have thrown error");
    } catch (error) {
      assertEquals(error, testError);
    }

    // Should still log the timing even when error occurs
    assertGreater(logger.getEntries().length, 0);

    // Cleanup
    logger.setEnabled(false);
    logger.clear();
  });
});

Deno.test("BreakdownLogger - Edge Cases and Error Handling", async (t) => {
  let logger: BreakdownLogger;

  const setup = () => {
    logger = BreakdownLogger.getInstance();
    logger.clear();
    logger.setEnabled(true);
  };

  const teardown = () => {
    logger.setEnabled(false);
    logger.clear();
  };

  await t.step("handles very large log data", () => {
    // Arrange
    setup();
    const context = createTestContext("large-data-test", "act");
    const largeData = {
      array: Array.from({ length: 1000 }, (_, i) => `item-${i}`),
      object: Object.fromEntries(
        Array.from({ length: 500 }, (_, i) => [`key${i}`, `value${i}`]),
      ),
    };

    // Act
    logger.info(context, "Large data test", largeData);

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].data, largeData);

    // Cleanup
    teardown();
  });

  await t.step("handles circular references in data", () => {
    // Arrange
    setup();
    const context = createTestContext("circular-test", "act");
    // deno-lint-ignore no-explicit-any
    const circularData: any = { name: "test" };
    circularData.self = circularData;

    // Act - Should not throw
    logger.info(context, "Circular data test", circularData);

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].message, "Circular data test");

    // Cleanup
    teardown();
  });

  await t.step("handles special characters in messages", () => {
    // Arrange
    setup();
    const context = createTestContext("特殊文字テスト", "arrange");
    const specialMessage =
      "Test with 特殊文字, emojis 🚀🎉, and\nnewlines\ttabs";

    // Act
    logger.info(context, specialMessage);

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].message, specialMessage);
    assertEquals(entries[0].context.testName, "特殊文字テスト");

    // Cleanup
    teardown();
  });

  await t.step("handles concurrent logging correctly", async () => {
    // Arrange
    setup();
    const promises: Promise<void>[] = [];

    // Act
    for (let i = 0; i < 10; i++) {
      const promise = new Promise<void>((resolve) => {
        const context = createTestContext(`concurrent-${i}`, "act");
        logger.info(context, `Message ${i}`, { index: i });
        resolve();
      });
      promises.push(promise);
    }

    await Promise.all(promises);

    // Assert
    const entries = logger.getEntries();
    assertEquals(entries.length, 10);

    // Verify all messages are logged
    const messages = entries.map((e) => e.message).sort();
    for (let i = 0; i < 10; i++) {
      assert(messages.includes(`Message ${i}`));
    }

    // Cleanup
    teardown();
  });

  await t.step("timer cleanup works correctly", () => {
    // Arrange
    setup();

    // Act
    logger.startTimer("timer1");
    logger.startTimer("timer2");
    logger.startTimer("timer3");

    // End one timer
    const duration1 = logger.endTimer("timer1");

    // Clear all
    logger.clear();

    // Try to end timers after clear
    const duration2 = logger.endTimer("timer2");
    const duration3 = logger.endTimer("timer3");

    // Assert
    assertExists(duration1);
    assertEquals(duration2, undefined);
    assertEquals(duration3, undefined);

    // Cleanup
    teardown();
  });

  await t.step("multiple timer operations on same key", () => {
    // Arrange
    setup();

    // Act
    logger.startTimer("reused-key");
    const firstStart = performance.now();
    while (performance.now() - firstStart < 1) {
      // Busy wait
    }
    const duration1 = logger.endTimer("reused-key");

    // Start again with same key
    logger.startTimer("reused-key");
    const secondStart = performance.now();
    while (performance.now() - secondStart < 1) {
      // Busy wait
    }
    const duration2 = logger.endTimer("reused-key");

    // Assert
    assertExists(duration1);
    assertExists(duration2);
    assertGreater(duration1!, 0);
    assertGreater(duration2!, 0);

    // Cleanup
    teardown();
  });
});
