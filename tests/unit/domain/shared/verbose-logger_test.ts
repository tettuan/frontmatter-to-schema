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

// Mock logger that captures calls for testing
class MockLogger implements Logger {
  public calls: Array<{
    method: "info" | "warn" | "error" | "debug";
    message: string;
    data?: Record<string, unknown>;
  }> = [];

  info(message: string, data?: Record<string, unknown>): void {
    this.calls.push({ method: "info", message, data });
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.calls.push({ method: "warn", message, data });
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.calls.push({ method: "error", message, data });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.calls.push({ method: "debug", message, data });
  }

  reset(): void {
    this.calls = [];
  }

  getLastCall(method: "info" | "warn" | "error" | "debug") {
    return this.calls.filter((call) => call.method === method).pop();
  }
}

Deno.test("VerboseLogger - constructor detects verbose mode from environment", () => {
  // Save original environment
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");

  try {
    // Test verbose mode enabled
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const verboseLogger = new VerboseLogger("test-service");
    assertEquals(verboseLogger.enabled, true);

    // Test verbose mode disabled (explicit false)
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "false");
    const nonVerboseLogger = new VerboseLogger("test-service");
    assertEquals(nonVerboseLogger.enabled, false);

    // Test verbose mode disabled (unset)
    Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    const defaultLogger = new VerboseLogger("test-service");
    assertEquals(defaultLogger.enabled, false);

    // Test verbose mode disabled (other value)
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "yes");
    const otherValueLogger = new VerboseLogger("test-service");
    assertEquals(otherValueLogger.enabled, false);
  } finally {
    // Restore original environment
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - info method logs when verbose mode enabled", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    // Mock StructuredLogger.getServiceLogger
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    // Test with verbose mode enabled
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const logger = new VerboseLogger("test-service");

    // Test info without data
    logger.info("Test info message");
    const infoCall = mockLogger.getLastCall("info");
    assertEquals(infoCall?.message, "Test info message");
    assertEquals(infoCall?.data, undefined);

    // Reset mock
    mockLogger.reset();

    // Test info with data
    const testData = { key: "value", count: 42 };
    logger.info("Test info with data", testData);
    const infoWithDataCall = mockLogger.getLastCall("info");
    assertEquals(infoWithDataCall?.message, "Test info with data");
    assertEquals(infoWithDataCall?.data, testData);

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - info method does not log when verbose mode disabled", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    // Mock StructuredLogger.getServiceLogger
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    // Test with verbose mode disabled
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "false");
    const logger = new VerboseLogger("test-service");

    logger.info("Test info message");
    assertEquals(mockLogger.calls.length, 0); // Should not be called

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - warn method logs when verbose mode enabled", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const logger = new VerboseLogger("warn-service");

    // Test warn without data
    logger.warn("Test warning message");
    const warnCall = mockLogger.getLastCall("warn");
    assertEquals(warnCall?.message, "Test warning message");
    assertEquals(warnCall?.data, undefined);

    // Reset mock
    mockLogger.reset();

    // Test warn with data
    const warnData = { error: "deprecated", version: "1.0" };
    logger.warn("Deprecation warning", warnData);
    const warnWithDataCall = mockLogger.getLastCall("warn");
    assertEquals(warnWithDataCall?.message, "Deprecation warning");
    assertEquals(warnWithDataCall?.data, warnData);

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - warn method does not log when verbose mode disabled", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.delete("FRONTMATTER_VERBOSE_MODE"); // Unset = disabled
    const logger = new VerboseLogger("warn-service");

    logger.warn("Test warning message");
    assertEquals(mockLogger.calls.length, 0); // Should not be called

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - error method logs when verbose mode enabled", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const logger = new VerboseLogger("error-service");

    // Test error without data
    logger.error("Test error message");
    const errorCall = mockLogger.getLastCall("error");
    assertEquals(errorCall?.message, "Test error message");
    assertEquals(errorCall?.data, undefined);

    // Reset mock
    mockLogger.reset();

    // Test error with data
    const errorData = { stack: "trace", code: 500 };
    logger.error("Critical error occurred", errorData);
    const errorWithDataCall = mockLogger.getLastCall("error");
    assertEquals(errorWithDataCall?.message, "Critical error occurred");
    assertEquals(errorWithDataCall?.data, errorData);

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - error method does not log when verbose mode disabled", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "false");
    const logger = new VerboseLogger("error-service");

    logger.error("Test error message");
    assertEquals(mockLogger.calls.length, 0); // Should not be called

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - enabled property reflects verbose mode state", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");

  try {
    // Test enabled when FRONTMATTER_VERBOSE_MODE is "true"
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const enabledLogger = new VerboseLogger("enabled-service");
    assertEquals(enabledLogger.enabled, true);

    // Test disabled when FRONTMATTER_VERBOSE_MODE is unset
    Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    const disabledLogger = new VerboseLogger("disabled-service");
    assertEquals(disabledLogger.enabled, false);

    // Test disabled when FRONTMATTER_VERBOSE_MODE is "false"
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "false");
    const explicitlyDisabledLogger = new VerboseLogger(
      "explicit-disabled-service",
    );
    assertEquals(explicitlyDisabledLogger.enabled, false);

    // Test disabled when FRONTMATTER_VERBOSE_MODE is some other value
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "debug");
    const otherValueLogger = new VerboseLogger("other-value-service");
    assertEquals(otherValueLogger.enabled, false);
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - createScoped creates logger with scoped service name", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const parentLogger = new VerboseLogger("parent-service");
    const scopedLogger = parentLogger.createScoped("child-scope");

    // Verify scoped logger inherits verbose mode
    assertEquals(scopedLogger.enabled, true);

    // Verify scoped logger uses combined service name
    scopedLogger.info("Scoped message");
    const call = mockLogger.getLastCall("info");
    assertEquals(call?.message, "Scoped message");

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - createScoped preserves disabled state", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "false");
    const parentLogger = new VerboseLogger("parent-service");
    const scopedLogger = parentLogger.createScoped("child-scope");

    // Verify scoped logger inherits disabled state
    assertEquals(scopedLogger.enabled, false);

    // Verify scoped logger doesn't log when disabled
    scopedLogger.info("Should not log");
    assertEquals(mockLogger.calls.length, 0); // Should not be called

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - multiple scoping levels work correctly", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const rootLogger = new VerboseLogger("root");
    const level1Logger = rootLogger.createScoped("level1");
    const level2Logger = level1Logger.createScoped("level2");

    // Test deeply nested scoped service name
    level2Logger.warn("Deeply nested message");
    const call = mockLogger.getLastCall("warn");
    assertEquals(call?.message, "Deeply nested message");

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - handles undefined and null data correctly", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      () => mockLogger,
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const logger = new VerboseLogger("data-test");

    // Test with undefined (which becomes omitted parameter)
    logger.info("Message with undefined");
    const call1 = mockLogger.getLastCall("info");
    assertEquals(call1?.data, undefined);

    // Reset mock
    mockLogger.reset();

    // Test with explicitly passed undefined
    logger.warn("Message with explicit undefined", undefined);
    const call2 = mockLogger.getLastCall("warn");
    assertEquals(call2?.data, undefined);

    // Reset mock
    mockLogger.reset();

    // Test with null (which should be passed through)
    logger.error(
      "Message with null",
      null as unknown as Record<string, unknown>,
    );
    const call3 = mockLogger.getLastCall("error");
    assertEquals(call3?.data, null);

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - service name correctly passed to StructuredLogger", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();
  let capturedServiceName = "";

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      (serviceName: string) => {
        capturedServiceName = serviceName;
        return mockLogger;
      },
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const logger = new VerboseLogger("specific-service-name");

    logger.info("Test message");
    assertEquals(capturedServiceName, "specific-service-name");

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});

Deno.test("VerboseLogger - scoped service name correctly formatted", () => {
  const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
  const mockLogger = new MockLogger();
  let capturedServiceName = "";

  try {
    const getServiceLoggerStub = stub(
      StructuredLogger,
      "getServiceLogger",
      (serviceName: string) => {
        capturedServiceName = serviceName;
        return mockLogger;
      },
    );

    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");
    const logger = new VerboseLogger("parent");
    const scopedLogger = logger.createScoped("child");

    scopedLogger.info("Test scoped message");
    assertEquals(capturedServiceName, "parent-child");

    getServiceLoggerStub.restore();
  } finally {
    if (originalVerbose !== undefined) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  }
});
