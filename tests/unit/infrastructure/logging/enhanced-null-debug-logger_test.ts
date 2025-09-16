import { assertEquals, assertExists } from "jsr:@std/assert";
import { EnhancedNullDebugLogger } from "../../../../src/infrastructure/logging/enhanced-null-debug-logger.ts";
import { LogLevels } from "../../../../src/domain/shared/services/debug-logger.ts";

Deno.test("EnhancedNullDebugLogger", async (t) => {
  await t.step("should create successfully", () => {
    const result = EnhancedNullDebugLogger.create(LogLevels.DEBUG, true);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      assertEquals(result.data.getLevel(), LogLevels.DEBUG);
      assertEquals(result.data.isEnabled(), true);
    }
  });

  await t.step("should create disabled logger", () => {
    const result = EnhancedNullDebugLogger.createDisabled();
    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      assertEquals(result.data.getLevel(), LogLevels.ERROR);
      assertEquals(result.data.isEnabled(), false);
    }
  });

  await t.step("should do nothing for all log methods", () => {
    const result = EnhancedNullDebugLogger.createDisabled();
    assertEquals(result.ok, true);
    if (result.ok) {
      const logger = result.data;

      // Test standard log methods
      assertEquals(logger.error("test").ok, true);
      assertEquals(logger.warn("test").ok, true);
      assertEquals(logger.info("test").ok, true);
      assertEquals(logger.debug("test").ok, true);
      assertEquals(logger.trace("test").ok, true);

      // Test enhanced log methods
      assertEquals(logger.output("test").ok, true);
      assertEquals(logger.errorOutput("test").ok, true);
      assertEquals(
        logger.progress("test", {
          operation: "test",
          itemsProcessed: 1,
          totalItems: 10,
        }).ok,
        true,
      );
      assertEquals(
        logger.metrics("test", {
          operation: "test",
          duration: 100,
        }).ok,
        true,
      );
    }
  });

  await t.step("should return self for context methods", () => {
    const result = EnhancedNullDebugLogger.createDisabled();
    assertEquals(result.ok, true);
    if (result.ok) {
      const logger = result.data;

      const withContext = logger.withContext({
        component: "test",
        timestamp: new Date().toISOString(),
      });
      assertEquals(withContext, logger);

      const withOperation = logger.withOperationContext("test-operation");
      assertEquals(withOperation, logger);

      const child = logger.createChild({
        component: "child",
        timestamp: new Date().toISOString(),
      });
      assertEquals(child, logger);
    }
  });
});
