import { assertEquals } from "jsr:@std/assert";
import { assertFalse } from "jsr:@std/assert/false";
import { assert as assertTrue } from "jsr:@std/assert/assert";
import {
  RecoveryStrategy,
  RecoveryStrategyConfig,
} from "../../../../../src/domain/recovery/value-objects/recovery-strategy.ts";

Deno.test("RecoveryStrategy - Smart Constructor", async (t) => {
  await t.step("should create strategy with immediate type", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 3 },
      priority: 5,
    };

    const result = RecoveryStrategy.create(config);

    assertTrue(result.ok);
    if (result.ok) {
      assertEquals(result.data.getErrorKind(), "MissingRequired");
      assertEquals(result.data.getMaxAttempts(), 3);
      assertEquals(result.data.getPriority(), 5);
      assertEquals(result.data.getStrategyType().kind, "immediate");
    }
  });

  await t.step("should create strategy with delayed type", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "FileNotFound",
      strategy: { kind: "delayed", delayMs: 1000, maxAttempts: 2 },
      priority: 7,
    };

    const result = RecoveryStrategy.create(config);

    assertTrue(result.ok);
    if (result.ok) {
      assertEquals(result.data.getErrorKind(), "FileNotFound");
      assertEquals(result.data.getMaxAttempts(), 2);
      assertEquals(result.data.calculateDelay(1), 1000);
    }
  });

  await t.step("should create strategy with exponential type", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "InitializationError",
      strategy: {
        kind: "exponential",
        baseDelayMs: 100,
        multiplier: 2,
        maxAttempts: 4,
      },
      priority: 9,
    };

    const result = RecoveryStrategy.create(config);

    assertTrue(result.ok);
    if (result.ok) {
      assertEquals(result.data.calculateDelay(1), 100);
      assertEquals(result.data.calculateDelay(2), 200);
      assertEquals(result.data.calculateDelay(3), 400);
    }
  });

  await t.step("should create strategy with none type", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "ConfigurationError",
      strategy: { kind: "none" },
      priority: 1,
    };

    const result = RecoveryStrategy.create(config);

    assertTrue(result.ok);
    if (result.ok) {
      assertEquals(result.data.getMaxAttempts(), 0);
      assertEquals(result.data.calculateDelay(1), 0);
    }
  });
});

Deno.test("RecoveryStrategy - Validation", async (t) => {
  await t.step("should reject invalid priority range (too low)", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 3 },
      priority: -1,
    };

    const result = RecoveryStrategy.create(config);

    assertFalse(result.ok);
    assertEquals(result.error.kind, "ConfigurationError");
    assertTrue(
      result.error.message.includes("priority must be between 0 and 10"),
    );
  });

  await t.step("should reject invalid priority range (too high)", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 3 },
      priority: 11,
    };

    const result = RecoveryStrategy.create(config);

    assertFalse(result.ok);
    assertEquals(result.error.kind, "ConfigurationError");
  });

  await t.step("should reject invalid immediate strategy maxAttempts", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 0 },
      priority: 5,
    };

    const result = RecoveryStrategy.create(config);

    assertFalse(result.ok);
    assertEquals(result.error.kind, "ConfigurationError");
    assertTrue(
      result.error.message.includes("maxAttempts must be between 1 and 10"),
    );
  });

  await t.step("should reject invalid delayed strategy delayMs", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "FileNotFound",
      strategy: { kind: "delayed", delayMs: -1, maxAttempts: 2 },
      priority: 5,
    };

    const result = RecoveryStrategy.create(config);

    assertFalse(result.ok);
    assertEquals(result.error.kind, "ConfigurationError");
    assertTrue(
      result.error.message.includes("delayMs must be between 0 and 60000"),
    );
  });

  await t.step("should reject invalid exponential strategy multiplier", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "InitializationError",
      strategy: {
        kind: "exponential",
        baseDelayMs: 100,
        multiplier: 0.5,
        maxAttempts: 3,
      },
      priority: 5,
    };

    const result = RecoveryStrategy.create(config);

    assertFalse(result.ok);
    assertEquals(result.error.kind, "ConfigurationError");
    assertTrue(
      result.error.message.includes("multiplier must be between 1 and 5"),
    );
  });
});

Deno.test("RecoveryStrategy - Behavior", async (t) => {
  await t.step("should correctly identify recoverable errors", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "InvalidType",
      strategy: { kind: "immediate", maxAttempts: 2 },
      priority: 5,
    };

    const result = RecoveryStrategy.create(config);
    assertTrue(result.ok);
    if (result.ok) {
      assertTrue(result.data.canRecover("InvalidType"));
      assertFalse(result.data.canRecover("SomeOtherError"));
    }
  });

  await t.step("should calculate exponential delays correctly", () => {
    const config: RecoveryStrategyConfig = {
      errorKind: "InitializationError",
      strategy: {
        kind: "exponential",
        baseDelayMs: 200,
        multiplier: 3,
        maxAttempts: 4,
      },
      priority: 8,
    };

    const result = RecoveryStrategy.create(config);
    assertTrue(result.ok);
    if (result.ok) {
      assertEquals(result.data.calculateDelay(1), 200); // 200 * 3^0 = 200
      assertEquals(result.data.calculateDelay(2), 600); // 200 * 3^1 = 600
      assertEquals(result.data.calculateDelay(3), 1800); // 200 * 3^2 = 1800
      assertEquals(result.data.calculateDelay(4), 5400); // 200 * 3^3 = 5400
    }
  });

  await t.step(
    "should return zero delay for immediate and none strategies",
    () => {
      const immediateConfig: RecoveryStrategyConfig = {
        errorKind: "MissingRequired",
        strategy: { kind: "immediate", maxAttempts: 3 },
        priority: 5,
      };

      const noneConfig: RecoveryStrategyConfig = {
        errorKind: "ConfigurationError",
        strategy: { kind: "none" },
        priority: 1,
      };

      const immediateResult = RecoveryStrategy.create(immediateConfig);
      const noneResult = RecoveryStrategy.create(noneConfig);

      assertTrue(immediateResult.ok);
      assertTrue(noneResult.ok);
      if (immediateResult.ok && noneResult.ok) {
        assertEquals(immediateResult.data.calculateDelay(1), 0);
        assertEquals(immediateResult.data.calculateDelay(5), 0);
        assertEquals(noneResult.data.calculateDelay(1), 0);
      }
    },
  );
});
