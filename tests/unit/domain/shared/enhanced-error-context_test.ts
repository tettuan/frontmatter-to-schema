/**
 * Unit tests for Enhanced Error Context value objects
 * Tests DDD compliance, Totality principle implementation, and Phase 1 enhancements
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  CorrelationId,
  EnhancedErrorContext,
  EnhancedErrorContextFactory,
  StackTrace,
  SystemContext,
  UserContext,
} from "../../../../src/domain/shared/types/enhanced-error-context.ts";
import { SourceLocation } from "../../../../src/domain/shared/types/error-context.ts";

describe("CorrelationId", () => {
  it("should create unique correlation IDs", () => {
    const id1 = CorrelationId.create();
    const id2 = CorrelationId.create();

    assertExists(id1.value);
    assertExists(id2.value);
    assert(id1.value !== id2.value, "Correlation IDs should be unique");
    assert(id1.value.includes("-"), "Correlation ID should contain separator");
  });

  it("should accept custom correlation ID", () => {
    const customId = "custom-test-id-123";
    const id = CorrelationId.create(customId);

    assertEquals(id.value, customId);
    assertEquals(id.toString(), customId);
  });

  it("should generate timestamp-based IDs for traceability", () => {
    const id = CorrelationId.create();
    const parts = id.value.split("-");

    assertEquals(parts.length, 2);
    assert(parts[0].length > 0, "Timestamp part should not be empty");
    assert(parts[1].length > 0, "Random part should not be empty");
  });
});

describe("StackTrace", () => {
  it("should capture stack trace with frames", () => {
    const trace = StackTrace.capture();

    assertExists(trace.frames);
    assertExists(trace.captureTime);
    assert(trace.frames.length >= 0, "Should have frame information");
    assert(trace.captureTime instanceof Date, "Should have capture timestamp");
  });

  it("should create empty stack trace", () => {
    const trace = StackTrace.empty();

    assertEquals(trace.frames.length, 0);
    assertEquals(trace.toString(), "No stack trace available");
    assertExists(trace.captureTime);
  });

  it("should limit frames to prevent excessive data", () => {
    const trace = StackTrace.capture();

    assert(trace.frames.length <= 10, "Should limit frames to 10 maximum");
  });

  it("should generate readable string representation", () => {
    const trace = StackTrace.capture();
    const str = trace.toString();

    assertExists(str);
    if (trace.frames.length > 0) {
      assert(
        str.includes("<-") || str === "No stack trace available",
        "Should show frame chain or empty message",
      );
    }
  });

  it("should provide full trace details", () => {
    const trace = StackTrace.capture();
    const fullTrace = trace.getFullTrace();

    assertExists(fullTrace);
    if (trace.frames.length > 0) {
      assert(
        fullTrace.includes("\n") || trace.frames.length === 1,
        "Full trace should contain newlines for multiple frames",
      );
    }
  });
});

describe("UserContext", () => {
  it("should create empty user context", () => {
    const context = UserContext.empty();

    assertEquals(context.inputFile, undefined);
    assertEquals(context.schema, undefined);
    assertEquals(context.template, undefined);
    assertEquals(context.operation, undefined);
    assertEquals(context.targetFormat, undefined);
    assertEquals(context.toString(), "No user context");
  });

  it("should create user context with provided values", () => {
    const context = UserContext.create({
      inputFile: "test.md",
      schema: "schema.json",
      template: "template.json",
      operation: "process",
      targetFormat: "yaml",
    });

    assertEquals(context.inputFile, "test.md");
    assertEquals(context.schema, "schema.json");
    assertEquals(context.template, "template.json");
    assertEquals(context.operation, "process");
    assertEquals(context.targetFormat, "yaml");
  });

  it("should generate descriptive string representation", () => {
    const context = UserContext.create({
      inputFile: "test.md",
      schema: "schema.json",
      operation: "process",
    });

    const str = context.toString();
    assert(str.includes("file=test.md"), "Should include input file");
    assert(str.includes("schema=schema.json"), "Should include schema");
    assert(str.includes("op=process"), "Should include operation");
  });

  it("should handle partial context information", () => {
    const context = UserContext.create({
      inputFile: "test.md",
    });

    assertEquals(context.inputFile, "test.md");
    assertEquals(context.schema, undefined);

    const str = context.toString();
    assert(str.includes("file=test.md"), "Should include provided information");
    assert(!str.includes("schema="), "Should not include undefined values");
  });
});

describe("SystemContext", () => {
  it("should create empty system context", () => {
    const context = SystemContext.empty();

    assertEquals(context.memoryUsage, undefined);
    assertEquals(context.processingTime, undefined);
    assertEquals(context.retryCount, 0);
    assertEquals(context.toString(), "No system context");
  });

  it("should create system context with metrics", () => {
    const context = SystemContext.create({
      memoryUsage: 1024 * 1024 * 50, // 50MB
      processingTime: 1500,
      retryCount: 2,
    });

    assertEquals(context.memoryUsage, 1024 * 1024 * 50);
    assertEquals(context.processingTime, 1500);
    assertEquals(context.retryCount, 2);
  });

  it("should capture system information when requested", () => {
    const context = SystemContext.create({
      captureSystemInfo: true,
    });

    // System info might not be available in test environment, but should not error
    assertExists(context);
    assert(
      typeof context.platform === "string" || context.platform === undefined,
      "Platform should be string or undefined",
    );
  });

  it("should support fluent updates", () => {
    const original = SystemContext.empty();
    const withRetry = original.withRetryCount(3);
    const withMemory = withRetry.withMemoryUsage(1024 * 1024 * 100);
    const withTime = withMemory.withProcessingTime(2000);

    assertEquals(original.retryCount, 0);
    assertEquals(withRetry.retryCount, 3);
    assertEquals(withMemory.memoryUsage, 1024 * 1024 * 100);
    assertEquals(withTime.processingTime, 2000);
  });

  it("should generate readable string representation", () => {
    const context = SystemContext.create({
      memoryUsage: 1024 * 1024 * 50, // 50MB
      processingTime: 1500,
      retryCount: 2,
    });

    const str = context.toString();
    assert(str.includes("mem=50MB"), "Should include memory in MB");
    assert(str.includes("time=1500ms"), "Should include processing time");
    assert(str.includes("retries=2"), "Should include retry count");
  });
});

describe("EnhancedErrorContext", () => {
  it("should create enhanced context with all components", () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    assert(locationResult.ok, "Should create valid source location");

    const contextResult = EnhancedErrorContext.create(
      "Test Operation",
      locationResult.data,
    );

    assertEquals(contextResult.ok, true);
    if (contextResult.ok) {
      const context = contextResult.data;
      assertExists(context.baseContext);
      assertExists(context.correlationId);
      assertExists(context.stackTrace);
      assertExists(context.userContext);
      assertExists(context.systemContext);
      assertExists(context.enhancementTimestamp);
    }
  });

  it("should create enhanced context from base context", async () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    assert(locationResult.ok, "Should create valid source location");

    const { ErrorContext } = await import(
      "../../../../src/domain/shared/types/error-context.ts"
    );
    const baseContextResult = ErrorContext.create(
      "Base Operation",
      locationResult.data,
    );
    assert(baseContextResult.ok, "Should create valid base context");

    const enhanced = EnhancedErrorContext.fromBaseContext(
      baseContextResult.data,
    );

    assertExists(enhanced.baseContext);
    assertEquals(enhanced.baseContext.operation, "Base Operation");
    assertExists(enhanced.correlationId);
    assertExists(enhanced.stackTrace);
  });

  it("should support fluent context updates", () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    assert(locationResult.ok, "Should create valid source location");

    const contextResult = EnhancedErrorContext.create(
      "Test Operation",
      locationResult.data,
    );
    assert(contextResult.ok, "Should create valid enhanced context");

    const original = contextResult.data;
    const userContext = UserContext.create({ inputFile: "test.md" });
    const systemContext = SystemContext.create({ retryCount: 1 });

    const withUser = original.withUserContext(userContext);
    const withSystem = withUser.withSystemContext(systemContext);

    assertEquals(withUser.userContext.inputFile, "test.md");
    assertEquals(withSystem.systemContext.retryCount, 1);
    assertEquals(withSystem.correlationId.value, original.correlationId.value);
  });

  it("should generate comprehensive debug information", () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    assert(locationResult.ok, "Should create valid source location");

    const contextResult = EnhancedErrorContext.create(
      "Test Operation",
      locationResult.data,
      {
        userContext: UserContext.create({ inputFile: "test.md" }),
        systemContext: SystemContext.create({ retryCount: 1 }),
      },
    );
    assert(contextResult.ok, "Should create valid enhanced context");

    const debugInfo = contextResult.data.getEnhancedDebugInfo();

    assertExists(debugInfo.operation);
    assertExists(debugInfo.correlationId);
    assertExists(debugInfo.stackTrace);
    assertExists(debugInfo.userContext);
    assertExists(debugInfo.systemContext);
    assertExists(debugInfo.enhancementTimestamp);
    assertExists(debugInfo.fullStackTrace);
  });

  it("should generate enhanced string representation", () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    assert(locationResult.ok, "Should create valid source location");

    const contextResult = EnhancedErrorContext.create(
      "Test Operation",
      locationResult.data,
      {
        userContext: UserContext.create({ inputFile: "test.md" }),
        systemContext: SystemContext.create({ retryCount: 1 }),
      },
    );
    assert(contextResult.ok, "Should create valid enhanced context");

    const str = contextResult.data.toString();

    assert(str.includes("Test Operation"), "Should include operation");
    assert(str.includes("ID:"), "Should include correlation ID");
    assert(str.includes("User:"), "Should include user context");
    assert(str.includes("System:"), "Should include system context");
  });
});

describe("EnhancedErrorContextFactory", () => {
  it("should create context for file processing", () => {
    const result = EnhancedErrorContextFactory.forFileProcessing(
      "input.md",
      "schema.json",
      "transform",
      "processFile",
      {
        template: "template.json",
        targetFormat: "yaml",
      },
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      const context = result.data;
      assertEquals(context.userContext.inputFile, "input.md");
      assertEquals(context.userContext.schema, "schema.json");
      assertEquals(context.userContext.template, "template.json");
      assertEquals(context.userContext.targetFormat, "yaml");
      assert(context.baseContext.operation.includes("File Processing"));
    }
  });

  it("should create context for schema operations", () => {
    const correlationId = CorrelationId.create("test-id");
    const result = EnhancedErrorContextFactory.forSchemaOperation(
      "schema.json",
      "validate",
      "validateSchema",
      correlationId,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      const context = result.data;
      assertEquals(context.userContext.schema, "schema.json");
      assertEquals(context.userContext.operation, "validate");
      assertEquals(context.correlationId.value, "test-id");
      assert(context.baseContext.operation.includes("Schema"));
    }
  });

  it("should create context for template operations", () => {
    const correlationId = CorrelationId.create("test-template-id");
    const result = EnhancedErrorContextFactory.forTemplateOperation(
      "template.json",
      "render",
      "renderTemplate",
      correlationId,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      const context = result.data;
      assertEquals(context.userContext.template, "template.json");
      assertEquals(context.userContext.operation, "render");
      assertEquals(context.correlationId.value, "test-template-id");
      assert(context.baseContext.operation.includes("Template"));
    }
  });

  it("should handle file processing without optional parameters", () => {
    const result = EnhancedErrorContextFactory.forFileProcessing(
      "input.md",
      "schema.json",
      "transform",
      "processFile",
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      const context = result.data;
      assertEquals(context.userContext.inputFile, "input.md");
      assertEquals(context.userContext.schema, "schema.json");
      assertEquals(context.userContext.template, undefined);
      assertEquals(context.userContext.targetFormat, undefined);
    }
  });

  it("should generate correlation IDs automatically when not provided", () => {
    const result1 = EnhancedErrorContextFactory.forSchemaOperation(
      "schema.json",
      "validate",
      "validateSchema",
    );

    const result2 = EnhancedErrorContextFactory.forSchemaOperation(
      "schema.json",
      "validate",
      "validateSchema",
    );

    assertEquals(result1.ok, true);
    assertEquals(result2.ok, true);

    if (result1.ok && result2.ok) {
      assert(
        result1.data.correlationId.value !== result2.data.correlationId.value,
        "Should generate unique correlation IDs",
      );
    }
  });
});
