/**
 * Unit tests for ErrorContext value objects
 * Tests DDD compliance and Totality principle implementation
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Decision,
  ErrorContext,
  ErrorContextFactory,
  InputParameters,
  ProcessingProgress,
  SourceLocation,
} from "../../../../src/domain/shared/types/error-context.ts";

describe("SourceLocation", () => {
  it("should create valid source location", () => {
    const result = SourceLocation.create("TestService", "testMethod", 42);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.service, "TestService");
      assertEquals(result.data.method, "testMethod");
      assertEquals(result.data.line, 42);
    }
  });

  it("should reject empty service name", () => {
    const result = SourceLocation.create("", "testMethod");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  it("should reject empty method name", () => {
    const result = SourceLocation.create("TestService", "");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  it("should generate correct string representation", () => {
    const result = SourceLocation.create("TestService", "testMethod", 42);
    if (result.ok) {
      assertEquals(result.data.toString(), "TestService.testMethod:42");
    }
  });
});

describe("Decision", () => {
  it("should create valid decision", () => {
    const result = Decision.create(
      "Choose template resolution strategy",
      ["explicit", "schema-derived"],
      "Explicit path provided in config",
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(
        result.data.description,
        "Choose template resolution strategy",
      );
      assertEquals(result.data.alternatives.length, 2);
      assertEquals(result.data.reasoning, "Explicit path provided in config");
      assertExists(result.data.timestamp);
    }
  });

  it("should reject empty description", () => {
    const result = Decision.create("", ["alt1"], "reason");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  it("should reject empty reasoning", () => {
    const result = Decision.create("description", ["alt1"], "");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });
});

describe("ProcessingProgress", () => {
  it("should create valid progress", () => {
    const result = ProcessingProgress.create(
      "Template Resolution",
      "Resolving template paths",
      ["Schema loaded", "Config parsed"],
      5,
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.stage, "Template Resolution");
      assertEquals(result.data.currentStep, "Resolving template paths");
      assertEquals(result.data.completedSteps.length, 2);
      assertEquals(result.data.totalSteps, 5);
      assertEquals(result.data.getCompletionPercentage(), 40);
    }
  });

  it("should reject invalid total steps", () => {
    const result = ProcessingProgress.create("stage", "step", [], 0);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "OutOfRange");
    }
  });

  it("should handle progress without total steps", () => {
    const result = ProcessingProgress.create("stage", "step");
    if (result.ok) {
      assertEquals(result.data.getCompletionPercentage(), undefined);
    }
  });
});

describe("InputParameters", () => {
  it("should create parameters with safe serialization", () => {
    const params = InputParameters.create({
      configPath: "/path/to/config",
      verboseMode: true,
      count: 42,
    });
    assertEquals(params.has("configPath"), true);
    assertEquals(params.get("configPath"), "/path/to/config");
    assertEquals(params.keys().length, 3);
  });

  it("should handle non-serializable values", () => {
    const circularObj: Record<string, unknown> = {};
    circularObj.self = circularObj;

    const params = InputParameters.create({
      normal: "value",
      circular: circularObj,
    });
    assertEquals(params.has("normal"), true);
    assertEquals(params.has("circular"), true);
    assertEquals(typeof params.get("circular"), "string");
  });

  it("should truncate large values", () => {
    const largeString = "x".repeat(2000);
    const params = InputParameters.create({ large: largeString });
    const retrieved = params.get("large") as string;
    assertEquals(retrieved.includes("(truncated)"), true);
  });
});

describe("ErrorContext", () => {
  it("should create basic error context", () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    if (!locationResult.ok) throw new Error("Location creation failed");

    const result = ErrorContext.create("Test Operation", locationResult.data);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.operation, "Test Operation");
      assertEquals(result.data.location.service, "TestService");
      assertExists(result.data.timestamp);
    }
  });

  it("should support method chaining for context building", () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    const decisionResult = Decision.create(
      "Test decision",
      ["a", "b"],
      "Testing",
    );
    if (!locationResult.ok || !decisionResult.ok) {
      throw new Error("Setup failed");
    }

    const contextResult = ErrorContext.create(
      "Test Operation",
      locationResult.data,
    );
    if (!contextResult.ok) throw new Error("Context creation failed");

    const enrichedContext = contextResult.data
      .withInput("testParam", "testValue")
      .withDecision(decisionResult.data);

    assertEquals(enrichedContext.inputs.has("testParam"), true);
    assertEquals(enrichedContext.decisions.length, 1);
  });

  it("should support context chain tracking", () => {
    const location1Result = SourceLocation.create("Service1", "method1");
    const location2Result = SourceLocation.create("Service2", "method2");
    if (!location1Result.ok || !location2Result.ok) {
      throw new Error("Location creation failed");
    }

    const parent = ErrorContext.create(
      "Parent Operation",
      location1Result.data,
    );
    const child = ErrorContext.create("Child Operation", location2Result.data);
    if (!parent.ok || !child.ok) throw new Error("Context creation failed");

    const childWithParent = child.data.withParent(parent.data);
    const chain = childWithParent.getContextChain();

    assertEquals(chain.length, 2);
    assertEquals(chain[0].operation, "Child Operation");
    assertEquals(chain[1].operation, "Parent Operation");
  });

  it("should generate debug information", () => {
    const locationResult = SourceLocation.create("TestService", "testMethod");
    if (!locationResult.ok) throw new Error("Location creation failed");

    const contextResult = ErrorContext.create(
      "Test Operation",
      locationResult.data,
    );
    if (!contextResult.ok) throw new Error("Context creation failed");

    const debugInfo = contextResult.data
      .withInput("param1", "value1")
      .getDebugInfo();

    assertEquals(debugInfo.operation, "Test Operation");
    assertEquals(debugInfo.location, "TestService.testMethod");
    assertExists(debugInfo.timestamp);
    assertEquals(debugInfo.contextDepth, 1);
  });
});

describe("ErrorContextFactory", () => {
  it("should create pipeline context", () => {
    const result = ErrorContextFactory.forPipeline(
      "Template Resolution",
      "resolveTemplatePaths",
      42,
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.operation, "Pipeline: Template Resolution");
      assertEquals(result.data.location.service, "PipelineOrchestrator");
      assertEquals(result.data.location.method, "resolveTemplatePaths");
    }
  });

  it("should create domain service context", () => {
    const result = ErrorContextFactory.forDomainService(
      "FrontmatterService",
      "Transform documents",
      "transformDocuments",
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(
        result.data.operation,
        "FrontmatterService: Transform documents",
      );
      assertEquals(result.data.location.service, "FrontmatterService");
    }
  });

  it("should create template context with path", () => {
    const result = ErrorContextFactory.forTemplate(
      "Render output",
      "/path/to/template.json",
      "renderTemplate",
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.operation, "Template: Render output");
      assertEquals(
        result.data.inputs.get("templatePath"),
        "/path/to/template.json",
      );
    }
  });

  it("should create schema context with path", () => {
    const result = ErrorContextFactory.forSchema(
      "Load schema",
      "/path/to/schema.json",
      "loadSchema",
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.operation, "Schema: Load schema");
      assertEquals(
        result.data.inputs.get("schemaPath"),
        "/path/to/schema.json",
      );
    }
  });
});
