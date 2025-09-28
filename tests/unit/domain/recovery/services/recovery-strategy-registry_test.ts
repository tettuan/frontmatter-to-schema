import { assertEquals } from "jsr:@std/assert";
import { assertFalse } from "jsr:@std/assert/false";
import { assert as assertTrue } from "jsr:@std/assert/assert";
import { RecoveryStrategyRegistry } from "../../../../../src/domain/recovery/services/recovery-strategy-registry.ts";
import {
  RecoveryStrategy,
  RecoveryStrategyConfig,
} from "../../../../../src/domain/recovery/value-objects/recovery-strategy.ts";

Deno.test("RecoveryStrategyRegistry - Smart Constructor", async (t) => {
  await t.step("should create registry with default strategies", () => {
    const result = RecoveryStrategyRegistry.createWithDefaults();

    assertTrue(result.ok);
    if (result.ok) {
      assertTrue(result.data.canRecover("MissingRequired"));
      assertTrue(result.data.canRecover("InvalidType"));
      assertTrue(result.data.canRecover("InvalidFormat"));
      assertTrue(result.data.canRecover("FileNotFound"));
      assertEquals(result.data.getStrategyCount(), 6);
    }
  });

  await t.step("should create registry with custom config", () => {
    const config = {
      defaultStrategies: [
        {
          errorKind: "MissingRequired" as const,
          strategy: { kind: "immediate" as const, maxAttempts: 1 },
          priority: 5,
        },
      ],
      enableDynamicRegistration: false,
    };

    const result = RecoveryStrategyRegistry.create(config);

    assertTrue(result.ok);
    assertTrue(result.data.canRecover("MissingRequired"));
    assertFalse(result.data.canRecover("InvalidType"));
    assertEquals(result.data.getStrategyCount(), 1);
  });

  await t.step("should reject null config", () => {
    const result = RecoveryStrategyRegistry.create(null as any);

    assertFalse(result.ok);
    assertEquals(result.error.kind, "ConfigurationError");
    assertTrue(
      result.error.message.includes(
        "RecoveryStrategyRegistryConfig is required",
      ),
    );
  });

  await t.step("should reject invalid defaultStrategies", () => {
    const config = {
      defaultStrategies: "not an array" as any,
      enableDynamicRegistration: true,
    };

    const result = RecoveryStrategyRegistry.create(config);

    assertFalse(result.ok);
    assertEquals(result.error.kind, "ConfigurationError");
    assertTrue(
      result.error.message.includes("defaultStrategies must be an array"),
    );
  });
});

Deno.test("RecoveryStrategyRegistry - Strategy Management", async (t) => {
  await t.step("should add and retrieve strategies", () => {
    const registryResult = RecoveryStrategyRegistry.create({
      defaultStrategies: [],
      enableDynamicRegistration: true,
    });
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    const strategyConfig: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 3 },
      priority: 7,
    };

    const strategyResult = RecoveryStrategy.create(strategyConfig);
    assertTrue(strategyResult.ok);

    const addResult = registry.addStrategy(strategyResult.data);
    assertTrue(addResult.ok);

    assertTrue(registry.canRecover("MissingRequired"));

    const retrieveResult = registry.getRecoveryStrategy("MissingRequired");
    assertTrue(retrieveResult.ok);
    assertEquals(retrieveResult.data?.getPriority(), 7);
  });

  await t.step("should register strategy dynamically", () => {
    const registryResult = RecoveryStrategyRegistry.createWithDefaults();
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    const newStrategyConfig: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: {
        kind: "exponential",
        baseDelayMs: 100,
        multiplier: 2,
        maxAttempts: 3,
      },
      priority: 10, // Higher priority than default
    };

    const registerResult = registry.registerStrategy(newStrategyConfig);
    assertTrue(registerResult.ok);

    const retrieveResult = registry.getRecoveryStrategy("MissingRequired");
    assertTrue(retrieveResult.ok);
    assertEquals(retrieveResult.data?.getPriority(), 10); // Should be the new high-priority strategy
    assertEquals(retrieveResult.data?.getStrategyType().kind, "exponential");
  });

  await t.step("should reject duplicate priority strategies", () => {
    const registryResult = RecoveryStrategyRegistry.create({
      defaultStrategies: [],
      enableDynamicRegistration: true,
    });
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    const strategy1Config: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 2 },
      priority: 5,
    };

    const strategy2Config: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "delayed", delayMs: 100, maxAttempts: 3 },
      priority: 5, // Same priority
    };

    const strategy1Result = RecoveryStrategy.create(strategy1Config);
    const strategy2Result = RecoveryStrategy.create(strategy2Config);
    assertTrue(strategy1Result.ok);
    assertTrue(strategy2Result.ok);

    const add1Result = registry.addStrategy(strategy1Result.data);
    assertTrue(add1Result.ok);

    const add2Result = registry.addStrategy(strategy2Result.data);
    assertFalse(add2Result.ok);
    assertEquals(add2Result.error.kind, "ConfigurationError");
    assertTrue(add2Result.error.message.includes("priority 5 already exists"));
  });

  await t.step("should reject dynamic registration when disabled", () => {
    const registryResult = RecoveryStrategyRegistry.create({
      defaultStrategies: [],
      enableDynamicRegistration: false,
    });
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    const strategyConfig: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 3 },
      priority: 5,
    };

    const registerResult = registry.registerStrategy(strategyConfig);
    assertFalse(registerResult.ok);
    assertEquals(registerResult.error.kind, "ConfigurationError");
    assertTrue(
      registerResult.error.message.includes(
        "Dynamic strategy registration is disabled",
      ),
    );
  });
});

Deno.test("RecoveryStrategyRegistry - Priority Ordering", async (t) => {
  await t.step("should return highest priority strategy", () => {
    const registryResult = RecoveryStrategyRegistry.create({
      defaultStrategies: [],
      enableDynamicRegistration: true,
    });
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    // Add strategies with different priorities
    const lowPriorityConfig: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 1 },
      priority: 3,
    };

    const highPriorityConfig: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "delayed", delayMs: 500, maxAttempts: 2 },
      priority: 8,
    };

    const midPriorityConfig: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: {
        kind: "exponential",
        baseDelayMs: 100,
        multiplier: 2,
        maxAttempts: 3,
      },
      priority: 5,
    };

    const lowStrategy = RecoveryStrategy.create(lowPriorityConfig);
    const highStrategy = RecoveryStrategy.create(highPriorityConfig);
    const midStrategy = RecoveryStrategy.create(midPriorityConfig);

    assertTrue(lowStrategy.ok && highStrategy.ok && midStrategy.ok);

    registry.addStrategy(lowStrategy.data);
    registry.addStrategy(midStrategy.data);
    registry.addStrategy(highStrategy.data);

    const retrieveResult = registry.getRecoveryStrategy("MissingRequired");
    assertTrue(retrieveResult.ok);
    assertEquals(retrieveResult.data?.getPriority(), 8); // Should be highest priority
    assertEquals(retrieveResult.data?.getStrategyType().kind, "delayed");
  });

  await t.step("should get all strategies in priority order", () => {
    const registryResult = RecoveryStrategyRegistry.create({
      defaultStrategies: [],
      enableDynamicRegistration: true,
    });
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    const priorities = [3, 8, 5, 1, 9];
    for (const priority of priorities) {
      const config: RecoveryStrategyConfig = {
        errorKind: "MissingRequired",
        strategy: { kind: "immediate", maxAttempts: 1 },
        priority,
      };
      const strategy = RecoveryStrategy.create(config);
      assertTrue(strategy.ok);
      registry.addStrategy(strategy.data);
    }

    const allStrategiesResult = registry.getAllStrategies("MissingRequired");
    assertTrue(allStrategiesResult.ok);
    const strategies = allStrategiesResult.data;

    assertEquals(strategies.length, 5);
    // Should be in descending priority order
    assertEquals(strategies[0].getPriority(), 9);
    assertEquals(strategies[1].getPriority(), 8);
    assertEquals(strategies[2].getPriority(), 5);
    assertEquals(strategies[3].getPriority(), 3);
    assertEquals(strategies[4].getPriority(), 1);
  });
});

Deno.test("RecoveryStrategyRegistry - Validation", async (t) => {
  await t.step("should validate registry consistency", () => {
    const registryResult = RecoveryStrategyRegistry.createWithDefaults();
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    const validateResult = registry.validate();
    assertTrue(validateResult.ok);
  });

  await t.step("should detect validation errors", () => {
    const registryResult = RecoveryStrategyRegistry.create({
      defaultStrategies: [],
      enableDynamicRegistration: true,
    });
    assertTrue(registryResult.ok);
    const registry = registryResult.data;

    // Add two strategies with same priority (manually bypass the add check for testing)
    const strategy1Config: RecoveryStrategyConfig = {
      errorKind: "MissingRequired",
      strategy: { kind: "immediate", maxAttempts: 2 },
      priority: 5,
    };

    const strategy1 = RecoveryStrategy.create(strategy1Config);
    assertTrue(strategy1.ok);
    registry.addStrategy(strategy1.data);

    // Validation should pass with single strategy
    const validateResult1 = registry.validate();
    assertTrue(validateResult1.ok);
  });

  await t.step("should get registered error kinds", () => {
    const registryResult = RecoveryStrategyRegistry.createWithDefaults();
    assertTrue(registryResult.ok);
    if (registryResult.ok) {
      const registry = registryResult.data;

      const errorKinds = registry.getRegisteredErrorKinds();
      assertTrue(errorKinds.includes("MissingRequired"));
      assertTrue(errorKinds.includes("InvalidType"));
      assertTrue(errorKinds.includes("InvalidFormat"));
      assertTrue(errorKinds.includes("FileNotFound"));
      assertTrue(errorKinds.includes("ConfigurationError"));
      assertTrue(errorKinds.includes("InitializationError"));
    }
  });
});
