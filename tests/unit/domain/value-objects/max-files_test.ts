/**
 * Tests for MaxFiles Value Object
 *
 * Validates Smart Constructor implementation and Totality compliance
 * for file processing limit management
 */

import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  MaxFiles,
  MaxFilesUtils,
  type ProcessingMode,
} from "../../../../src/domain/value-objects/max-files.ts";

Deno.test("MaxFiles - Smart Constructor Validation", async (t) => {
  await t.step("should create valid MaxFiles with strict mode", () => {
    const mode: ProcessingMode = {
      kind: "strict",
      description: "Conservative limits",
    };
    const result = MaxFiles.create(500, mode);

    assert(result.ok);
    assertEquals(result.data.getValue(), 500);
    assertEquals(result.data.getMode().kind, "strict");
  });

  await t.step("should create valid MaxFiles with performance mode", () => {
    const mode: ProcessingMode = {
      kind: "performance",
      description: "Higher limits",
    };
    const result = MaxFiles.create(5000, mode);

    assert(result.ok);
    assertEquals(result.data.getValue(), 5000);
    assertEquals(result.data.getMode().kind, "performance");
  });

  await t.step("should create valid MaxFiles with bulk mode", () => {
    const mode: ProcessingMode = {
      kind: "bulk",
      description: "Maximum limits",
    };
    const result = MaxFiles.create(30000, mode);

    assert(result.ok);
    assertEquals(result.data.getValue(), 30000);
    assertEquals(result.data.getMode().kind, "bulk");
  });
});

Deno.test("MaxFiles - Validation Error Cases", async (t) => {
  await t.step("should reject negative values", () => {
    const mode: ProcessingMode = { kind: "strict", description: "Test mode" };
    const result = MaxFiles.create(-1, mode);

    assertFalse(result.ok);
    assertEquals(result.error!.kind, "OutOfRange");
    assert(result.error!.message.includes("must be at least 1"));
  });

  await t.step("should reject zero values", () => {
    const mode: ProcessingMode = { kind: "strict", description: "Test mode" };
    const result = MaxFiles.create(0, mode);

    assertFalse(result.ok);
    assertEquals(result.error!.kind, "OutOfRange");
    assert(result.error!.message.includes("must be at least 1"));
  });

  await t.step("should reject values exceeding strict mode limit", () => {
    const mode: ProcessingMode = { kind: "strict", description: "Test mode" };
    const result = MaxFiles.create(2000, mode); // Exceeds 1000 limit

    assertFalse(result.ok);
    assertEquals(result.error!.kind, "OutOfRange");
    assert(result.error!.message.includes("exceeds limit for strict mode"));
  });

  await t.step("should reject values exceeding performance mode limit", () => {
    const mode: ProcessingMode = {
      kind: "performance",
      description: "Test mode",
    };
    const result = MaxFiles.create(15000, mode); // Exceeds 10000 limit

    assertFalse(result.ok);
    assertEquals(result.error!.kind, "OutOfRange");
    assert(
      result.error!.message.includes("exceeds limit for performance mode"),
    );
  });

  await t.step("should reject values exceeding bulk mode limit", () => {
    const mode: ProcessingMode = { kind: "bulk", description: "Test mode" };
    const result = MaxFiles.create(60000, mode); // Exceeds 50000 limit

    assertFalse(result.ok);
    assertEquals(result.error!.kind, "OutOfRange");
    assert(result.error!.message.includes("exceeds limit for bulk mode"));
  });
});

Deno.test("MaxFiles - Business Logic", async (t) => {
  await t.step("should correctly check if limit allows file count", () => {
    const result = MaxFiles.create(100, {
      kind: "strict",
      description: "Test",
    });
    assert(result.ok);
    const maxFiles = result.data;

    assert(maxFiles.allows(50));
    assert(maxFiles.allows(100));
    assertFalse(maxFiles.allows(101));
  });

  await t.step("should calculate remaining capacity correctly", () => {
    const result = MaxFiles.create(100, {
      kind: "strict",
      description: "Test",
    });
    assert(result.ok);
    const maxFiles = result.data;

    assertEquals(maxFiles.remainingCapacity(30), 70);
    assertEquals(maxFiles.remainingCapacity(100), 0);
    assertEquals(maxFiles.remainingCapacity(150), 0); // Never negative
  });

  await t.step("should support equality comparison", () => {
    const mode: ProcessingMode = { kind: "strict", description: "Test" };
    const result1 = MaxFiles.create(100, mode);
    const result2 = MaxFiles.create(100, mode);
    const result3 = MaxFiles.create(200, mode);

    assert(result1.ok && result2.ok && result3.ok);
    const maxFiles1 = result1.data;
    const maxFiles2 = result2.data;
    const maxFiles3 = result3.data;

    assert(maxFiles1.equals(maxFiles2));
    assertFalse(maxFiles1.equals(maxFiles3));
  });
});

Deno.test("MaxFiles - Factory Methods", async (t) => {
  await t.step("should create default MaxFiles successfully", () => {
    const maxFiles = MaxFiles.createDefault();

    assertEquals(maxFiles.getValue(), 1000);
    assertEquals(maxFiles.getMode().kind, "strict");
  });

  await t.step("should create MaxFiles for specific modes", () => {
    const strictResult = MaxFiles.createForMode({
      kind: "strict",
      description: "Test",
    });
    const performanceResult = MaxFiles.createForMode({
      kind: "performance",
      description: "Test",
    });
    const bulkResult = MaxFiles.createForMode({
      kind: "bulk",
      description: "Test",
    });

    assert(strictResult.ok);
    assert(performanceResult.ok);
    assert(bulkResult.ok);

    assertEquals(strictResult.data.getValue(), 100);
    assertEquals(performanceResult.data.getValue(), 1000);
    assertEquals(bulkResult.data.getValue(), 10000);
  });
});

Deno.test("MaxFilesUtils - Utility Functions", async (t) => {
  await t.step("should parse CLI argument successfully", () => {
    const result = MaxFilesUtils.fromCliArg("5000");

    assert(result.ok);
    assertEquals(result.data.getValue(), 5000);
    assertEquals(result.data.getMode().kind, "performance");
  });

  await t.step("should reject invalid CLI arguments", () => {
    const result1 = MaxFilesUtils.fromCliArg("not-a-number");
    const result2 = MaxFilesUtils.fromCliArg("");

    assertFalse(result1.ok);
    assertFalse(result2.ok);
    assertEquals(result1.error!.kind, "ParseError");
    assertEquals(result2.error!.kind, "ParseError");
  });

  await t.step("should create MaxFiles based on system capacity", () => {
    const lowMemory = MaxFilesUtils.fromSystemCapacity(256);
    const mediumMemory = MaxFilesUtils.fromSystemCapacity(1024);
    const highMemory = MaxFilesUtils.fromSystemCapacity(4096);

    // Low memory should use conservative defaults
    assertEquals(lowMemory.getMode().kind, "strict");

    // Medium memory should use performance mode
    assertEquals(mediumMemory.getMode().kind, "performance");

    // High memory should use bulk mode
    assertEquals(highMemory.getMode().kind, "bulk");
  });

  await t.step("should provide predefined defaults", () => {
    assertEquals(MaxFilesUtils.CLI_DEFAULT.getValue(), 1000);
    assertEquals(MaxFilesUtils.STRICT_DEFAULT.getValue(), 100);
    assertEquals(MaxFilesUtils.PERFORMANCE_DEFAULT.getValue(), 1000);
  });
});

Deno.test("MaxFiles - String Representation", async (t) => {
  await t.step("should provide meaningful toString", () => {
    const result = MaxFiles.create(500, {
      kind: "performance",
      description: "Test",
    });
    assert(result.ok);
    const maxFiles = result.data;
    const str = maxFiles.toString();

    assert(str.includes("500"));
    assert(str.includes("performance"));
  });
});

Deno.test("MaxFiles - Default Mode Behavior", async (t) => {
  await t.step("should use strict mode as default when none specified", () => {
    const result = MaxFiles.create(500);

    assert(result.ok);
    assertEquals(result.data.getMode().kind, "strict");
  });
});
