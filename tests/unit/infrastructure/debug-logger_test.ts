import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  ConsoleDebugLogger,
  DebugLevel,
  DebugLoggerFactory,
  NoOpDebugLogger,
} from "../../../src/infrastructure/adapters/debug-logger.ts";
import { createError } from "../../../src/domain/shared/types/errors.ts";
import { ok } from "../../../src/domain/shared/types/result.ts";

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
