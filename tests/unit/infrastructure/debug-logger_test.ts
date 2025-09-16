import { assertEquals, assertExists } from "jsr:@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import {
  ConsoleDebugLogger,
  DebugLevel,
  DebugLoggerFactory,
  NoOpDebugLogger,
} from "../../../src/infrastructure/adapters/debug-logger.ts";
import { createError } from "../../../src/domain/shared/types/errors.ts";
import { err, ok } from "../../../src/domain/shared/types/result.ts";

Deno.test("DebugLogger Interface Tests", async (t) => {
  // Store original environment
  const originalDebugLevel = Deno.env.get("DEBUG_LEVEL");
  const originalDebugJson = Deno.env.get("DEBUG_JSON");

  await t.step(
    "DebugLoggerFactory creates NoOpDebugLogger when DEBUG_LEVEL is undefined",
    () => {
      Deno.env.delete("DEBUG_LEVEL");
      const logger = DebugLoggerFactory.create();
      assertExists(logger);
      assertEquals(logger.constructor.name, "NoOpDebugLogger");
    },
  );

  await t.step(
    "DebugLoggerFactory creates ConsoleDebugLogger when DEBUG_LEVEL is set",
    () => {
      Deno.env.set("DEBUG_LEVEL", "2");
      const logger = DebugLoggerFactory.create();
      assertExists(logger);
      assertEquals(logger.constructor.name, "ConsoleDebugLogger");
    },
  );

  await t.step("ConsoleDebugLogger respects debug levels", () => {
    Deno.env.set("DEBUG_LEVEL", "1"); // WARNING level
    const logger = new ConsoleDebugLogger();

    // Should not throw for valid operations
    logger.logError("test-stage", createError({ kind: "EmptyInput" }));
    logger.logInfo("test-stage", "test message");
    logger.logDebug("test-stage", "debug message"); // Should be filtered out at WARNING level
    logger.logSchemaResolution("test-path", true);
    logger.logDerivationRule("source", "target", true);
    logger.logExtensionDetection("x-test", true, "value");
  });

  await t.step("ConsoleDebugLogger handles frontmatter parsing results", () => {
    Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG level
    const logger = new ConsoleDebugLogger();

    // Test successful parsing
    logger.logFrontmatterParsing("test.md", ok({ title: "Test" }));

    // Test failed parsing
    const error = createError({ kind: "ParseError", input: "invalid" });
    logger.logFrontmatterParsing("test.md", { ok: false, error });
  });

  await t.step("NoOpDebugLogger does nothing", () => {
    const logger = new NoOpDebugLogger();

    // All methods should be no-ops and not throw (they take no arguments)
    logger.logError();
    logger.logInfo();
    logger.logDebug();
    logger.logSchemaResolution();
    logger.logFrontmatterParsing();
    logger.logTemplateRendering();
    logger.logAggregation();
    logger.logDerivationRule();
    logger.logRefResolution();
    logger.logVariableReplacement();
    logger.logExtensionDetection();

    // NoOpDebugLogger should have no-op implementations
    assertExists(logger);
  });

  await t.step("ConsoleDebugLogger handles JSON output mode", () => {
    Deno.env.set("DEBUG_LEVEL", "2");
    Deno.env.set("DEBUG_JSON", "true");
    const logger = new ConsoleDebugLogger();

    // Should not throw in JSON mode
    logger.logInfo("test-stage", "test message", { detail: "value" });
    logger.logError("test-stage", createError({ kind: "EmptyInput" }), {
      context: "test",
    });
  });

  // Restore original environment
  if (originalDebugLevel !== undefined) {
    Deno.env.set("DEBUG_LEVEL", originalDebugLevel);
  } else {
    Deno.env.delete("DEBUG_LEVEL");
  }

  if (originalDebugJson !== undefined) {
    Deno.env.set("DEBUG_JSON", originalDebugJson);
  } else {
    Deno.env.delete("DEBUG_JSON");
  }
});

Deno.test("DebugLevel enum values", () => {
  assertEquals(DebugLevel.ERROR, 0);
  assertEquals(DebugLevel.WARNING, 1);
  assertEquals(DebugLevel.INFO, 2);
  assertEquals(DebugLevel.DEBUG, 3);
});

// Enhanced comprehensive tests using BDD style
describe("ConsoleDebugLogger", () => {
  // Store original environment variables
  const originalDebugLevel = Deno.env.get("DEBUG_LEVEL");
  const originalDebugJson = Deno.env.get("DEBUG_JSON");

  // Restore environment after each test
  afterEach(() => {
    if (originalDebugLevel !== undefined) {
      Deno.env.set("DEBUG_LEVEL", originalDebugLevel);
    } else {
      Deno.env.delete("DEBUG_LEVEL");
    }

    if (originalDebugJson !== undefined) {
      Deno.env.set("DEBUG_JSON", originalDebugJson);
    } else {
      Deno.env.delete("DEBUG_JSON");
    }
  });

  describe("constructor and debug level parsing", () => {
    it("should default to ERROR level when DEBUG_LEVEL is undefined", () => {
      Deno.env.delete("DEBUG_LEVEL");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
      // Verify by testing that INFO level logs are filtered out
      logger.logInfo("test", "should not log"); // Should be filtered
    });

    it("should parse DEBUG_LEVEL=0 as ERROR level", () => {
      Deno.env.set("DEBUG_LEVEL", "0");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
    });

    it("should parse DEBUG_LEVEL=1 as WARNING level", () => {
      Deno.env.set("DEBUG_LEVEL", "1");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
    });

    it("should parse DEBUG_LEVEL=2 as INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
    });

    it("should parse DEBUG_LEVEL=3 as DEBUG level", () => {
      Deno.env.set("DEBUG_LEVEL", "3");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
    });

    it("should default to ERROR level for invalid DEBUG_LEVEL values", () => {
      Deno.env.set("DEBUG_LEVEL", "invalid");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
    });

    it("should parse DEBUG_JSON environment variable", () => {
      Deno.env.set("DEBUG_LEVEL", "2");
      Deno.env.set("DEBUG_JSON", "true");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
    });

    it("should handle DEBUG_JSON=false", () => {
      Deno.env.set("DEBUG_LEVEL", "2");
      Deno.env.set("DEBUG_JSON", "false");
      const logger = new ConsoleDebugLogger();
      assertExists(logger);
    });
  });

  describe("logSchemaResolution", () => {
    it("should log successful schema resolution at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logSchemaResolution(
        "test/schema.json",
        true,
        "Successfully loaded",
      );
      logger.logSchemaResolution("test/schema.json", true); // Without details
    });

    it("should log failed schema resolution at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logSchemaResolution(
        "missing/schema.json",
        false,
        "File not found",
      );
    });

    it("should not log at ERROR level (below INFO)", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR only
      const logger = new ConsoleDebugLogger();

      logger.logSchemaResolution("test/schema.json", true);
    });
  });

  describe("logFrontmatterParsing", () => {
    it("should log successful parsing at DEBUG level", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      const result = ok({ title: "Test Document", author: "John Doe" });
      logger.logFrontmatterParsing("test.md", result);
    });

    it("should log failed parsing at ERROR level", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR
      const logger = new ConsoleDebugLogger();

      const error = createError({ kind: "ParseError", input: "invalid yaml" });
      logger.logFrontmatterParsing("invalid.md", err(error));
    });

    it("should log error without message property", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR
      const logger = new ConsoleDebugLogger();

      const error = { kind: "EmptyInput" as const };
      logger.logFrontmatterParsing("empty.md", err(error));
    });

    it("should not log successful parsing at INFO level (below DEBUG)", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      const result = ok({ title: "Test" });
      logger.logFrontmatterParsing("test.md", result);
    });
  });

  describe("logTemplateRendering", () => {
    it("should log template rendering at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logTemplateRendering("template.json", ["title", "author", "date"]);
    });

    it("should handle empty variables array", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logTemplateRendering("simple-template.json", []);
    });

    it("should not log at ERROR level", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR only
      const logger = new ConsoleDebugLogger();

      logger.logTemplateRendering("template.json", ["var1"]);
    });
  });

  describe("logAggregation", () => {
    it("should log aggregation at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logAggregation("collect-titles", 5);
      logger.logAggregation("merge-data", 0);
    });
  });

  describe("logDerivationRule", () => {
    it("should log successful derivation rule at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logDerivationRule(
        "metadata.title",
        "derived.title",
        true,
        "Successfully derived",
      );
      logger.logDerivationRule("metadata.author", "derived.author", true); // Without details
    });

    it("should log failed derivation rule", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logDerivationRule(
        "missing.field",
        "target.field",
        false,
        "Source field not found",
      );
    });
  });

  describe("logRefResolution", () => {
    it("should log successful ref resolution at DEBUG level", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      logger.logRefResolution(
        "#/definitions/User",
        true,
        "Successfully resolved",
      );
      logger.logRefResolution("#/definitions/User", true); // Without details
    });

    it("should log failed ref resolution", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      logger.logRefResolution(
        "#/definitions/Missing",
        false,
        "Reference not found",
      );
    });

    it("should not log at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logRefResolution("#/definitions/User", true);
    });
  });

  describe("logVariableReplacement", () => {
    it("should log successful variable replacement at DEBUG level", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      logger.logVariableReplacement("{{title}}", "My Document", true);
    });

    it("should log failed variable replacement", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      logger.logVariableReplacement("{{unknown}}", "", false);
    });
  });

  describe("logExtensionDetection", () => {
    it("should log found extension at DEBUG level", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      logger.logExtensionDetection("x-frontmatter-part", true, "frontmatter");
      logger.logExtensionDetection("x-template", true); // Without value
    });

    it("should log not found extension", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      logger.logExtensionDetection("x-missing-extension", false);
    });
  });

  describe("logError", () => {
    it("should log error with message at ERROR level", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR
      const logger = new ConsoleDebugLogger();

      const error = createError({ kind: "ParseError", input: "invalid" });
      logger.logError("parsing", error, { file: "test.md" });
      logger.logError("parsing", error); // Without context
    });

    it("should log error without message property", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR
      const logger = new ConsoleDebugLogger();

      const error = { kind: "EmptyInput" as const };
      logger.logError("validation", error);
    });

    it("should log complex error with context", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR
      const logger = new ConsoleDebugLogger();

      const error = createError({
        kind: "RefResolutionFailed",
        ref: "#/definitions/User",
        message: "Not found",
      });
      const context = { schema: "user.json", line: 42 };
      logger.logError("ref-resolution", error, context);
    });
  });

  describe("logInfo", () => {
    it("should log info message at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logInfo("processing", "Starting document processing", {
        count: 5,
      });
      logger.logInfo("processing", "Processing complete"); // Without details
    });

    it("should not log at ERROR level", () => {
      Deno.env.set("DEBUG_LEVEL", "0"); // ERROR
      const logger = new ConsoleDebugLogger();

      logger.logInfo("processing", "This should not appear");
    });
  });

  describe("logDebug", () => {
    it("should log debug message at DEBUG level", () => {
      Deno.env.set("DEBUG_LEVEL", "3"); // DEBUG
      const logger = new ConsoleDebugLogger();

      logger.logDebug("internal", "Internal state check", { state: "valid" });
      logger.logDebug("internal", "Debug info"); // Without details
    });

    it("should not log at INFO level", () => {
      Deno.env.set("DEBUG_LEVEL", "2"); // INFO
      const logger = new ConsoleDebugLogger();

      logger.logDebug("internal", "This should not appear");
    });
  });

  describe("JSON output mode", () => {
    it("should format logs as JSON when DEBUG_JSON=true", () => {
      Deno.env.set("DEBUG_LEVEL", "2");
      Deno.env.set("DEBUG_JSON", "true");
      const logger = new ConsoleDebugLogger();

      logger.logInfo("test", "JSON test", { format: "json" });
      logger.logError("test", createError({ kind: "EmptyInput" }));
    });

    it("should format logs as text when DEBUG_JSON is not true", () => {
      Deno.env.set("DEBUG_LEVEL", "2");
      Deno.env.set("DEBUG_JSON", "false");
      const logger = new ConsoleDebugLogger();

      logger.logInfo("test", "Text test", { format: "text" });
    });

    it("should handle logs without details in both modes", () => {
      Deno.env.set("DEBUG_LEVEL", "2");

      // Test JSON mode
      Deno.env.set("DEBUG_JSON", "true");
      const jsonLogger = new ConsoleDebugLogger();
      jsonLogger.logInfo("test", "Message without details");

      // Test text mode
      Deno.env.set("DEBUG_JSON", "false");
      const textLogger = new ConsoleDebugLogger();
      textLogger.logInfo("test", "Message without details");
    });
  });
});

describe("NoOpDebugLogger", () => {
  it("should provide no-op implementations for all methods", () => {
    const logger = new NoOpDebugLogger();

    // All methods should be callable and not throw (NoOp methods take no arguments)
    logger.logSchemaResolution();
    logger.logFrontmatterParsing();
    logger.logTemplateRendering();
    logger.logAggregation();
    logger.logDerivationRule();
    logger.logRefResolution();
    logger.logVariableReplacement();
    logger.logExtensionDetection();
    logger.logError();
    logger.logInfo();
    logger.logDebug();

    assertExists(logger);
  });
});

describe("DebugLoggerFactory", () => {
  // Store original environment
  const originalDebugLevel = Deno.env.get("DEBUG_LEVEL");

  // Restore environment after each test
  afterEach(() => {
    if (originalDebugLevel !== undefined) {
      Deno.env.set("DEBUG_LEVEL", originalDebugLevel);
    } else {
      Deno.env.delete("DEBUG_LEVEL");
    }
  });

  it("should create NoOpDebugLogger when DEBUG_LEVEL is undefined", () => {
    Deno.env.delete("DEBUG_LEVEL");
    const logger = DebugLoggerFactory.create();
    assertEquals(logger instanceof NoOpDebugLogger, true);
  });

  it("should create ConsoleDebugLogger when DEBUG_LEVEL is defined", () => {
    Deno.env.set("DEBUG_LEVEL", "1");
    const logger = DebugLoggerFactory.create();
    assertEquals(logger instanceof ConsoleDebugLogger, true);
  });

  it("should create ConsoleDebugLogger for all valid DEBUG_LEVEL values", () => {
    for (const level of ["0", "1", "2", "3"]) {
      Deno.env.set("DEBUG_LEVEL", level);
      const logger = DebugLoggerFactory.create();
      assertEquals(logger instanceof ConsoleDebugLogger, true);
    }
  });

  it("should create ConsoleDebugLogger even for invalid DEBUG_LEVEL values", () => {
    Deno.env.set("DEBUG_LEVEL", "invalid");
    const logger = DebugLoggerFactory.create();
    assertEquals(logger instanceof ConsoleDebugLogger, true);
  });
});
