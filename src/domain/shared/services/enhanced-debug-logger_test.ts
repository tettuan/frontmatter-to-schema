import { assert, assertEquals, assertFalse } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { createEnhancedDebugLogger } from "./enhanced-debug-logger.ts";

// Mock console.log for testing
let logOutputs: string[] = [];
const originalConsoleLog = console.log;

function mockConsoleLog() {
  logOutputs = [];
  console.log = (...args: unknown[]) => {
    logOutputs.push(args.join(" "));
  };
}

function restoreConsoleLog() {
  console.log = originalConsoleLog;
}

// Helper to set environment variables
function withEnvironment(envVars: Record<string, string>, fn: () => void) {
  const originalValues: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(envVars)) {
    originalValues[key] = Deno.env.get(key);
    Deno.env.set(key, value);
  }

  try {
    fn();
  } finally {
    for (const [key, originalValue] of Object.entries(originalValues)) {
      if (originalValue === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, originalValue);
      }
    }
  }
}

describe("EnhancedDebugLogger", () => {
  beforeEach(() => {
    mockConsoleLog();
  });

  afterEach(() => {
    restoreConsoleLog();
    // Clean up environment variables
    Deno.env.delete("LOG_LEVEL");
    Deno.env.delete("LOG_KEY");
    Deno.env.delete("DENO_TESTING");
  });

  describe("Basic Functionality", () => {
    it("should create logger successfully", () => {
      withEnvironment({ "DENO_TESTING": "true" }, () => {
        const result = createEnhancedDebugLogger("test-component");

        assert(result.ok);
        if (result.ok) {
          assert(typeof result.data.info === "function");
          assert(typeof result.data.debug === "function");
          assert(typeof result.data.error === "function");
        }
      });
    });

    it("should log messages in test environment", () => {
      withEnvironment({ "DENO_TESTING": "true" }, () => {
        const result = createEnhancedDebugLogger("test-component");

        assert(result.ok);
        if (result.ok) {
          const logResult = result.data.info("test message");
          assert(logResult.ok);
          assertEquals(logOutputs.length, 1);
          assert(logOutputs[0].includes("[test-component]"));
          assert(logOutputs[0].includes("test message"));
        }
      });
    });

    it("should not log outside test environment", () => {
      withEnvironment({ "DENO_TESTING": "false" }, () => {
        const result = createEnhancedDebugLogger("test-component");
        assert(result.ok);

        if (result.ok) {
          const logResult = result.data.info("test message");
          assert(logResult.ok);
          assertEquals(logOutputs.length, 0); // No output outside test environment
        }
      });
    });
  });

  describe("Environment Variable Support", () => {
    it("should filter by LOG_KEY", () => {
      withEnvironment({
        "LOG_KEY": "enabled-component",
        "DENO_TESTING": "true",
      }, () => {
        // Enabled component
        const enabledResult = createEnhancedDebugLogger("enabled-component");
        assert(enabledResult.ok);

        if (enabledResult.ok) {
          const logResult = enabledResult.data.info("enabled message");
          assert(logResult.ok);
          assertEquals(logOutputs.length, 1);
        }

        logOutputs = [];

        // Disabled component
        const disabledResult = createEnhancedDebugLogger("disabled-component");
        assert(disabledResult.ok);

        if (disabledResult.ok) {
          const logResult = disabledResult.data.info("disabled message");
          assertFalse(logResult.ok); // Should be filtered
          assertEquals(logOutputs.length, 0);
        }
      });
    });

    it("should support LOG_LEVEL filtering", () => {
      withEnvironment({
        "LOG_LEVEL": "warn",
        "DENO_TESTING": "true",
      }, () => {
        const result = createEnhancedDebugLogger("test-component");
        assert(result.ok);

        if (result.ok) {
          // Debug should be filtered
          const debugResult = result.data.debug("debug message");
          assertFalse(debugResult.ok);
          assertEquals(logOutputs.length, 0);

          // Warn should pass
          const warnResult = result.data.warn("warn message");
          assert(warnResult.ok);
          assertEquals(logOutputs.length, 1);
        }
      });
    });
  });

  describe("Enhanced Debug Methods", () => {
    it("should provide flow tracking", () => {
      withEnvironment({ "DENO_TESTING": "true" }, () => {
        const result = createEnhancedDebugLogger("test-component");
        assert(result.ok);

        if (result.ok) {
          const enhancedLogger = result.data as any; // Access enhanced methods

          if (enhancedLogger.trackFlow) {
            const flowResult = enhancedLogger.trackFlow("test-step", {
              phase: "processing",
            });
            assert(flowResult.ok);
            assertEquals(logOutputs.length, 1);
            assert(logOutputs[0].includes("FLOW: test-step"));
          }
        }
      });
    });
  });

  describe("Issue #1024 Resolution", () => {
    it("should address debug efficiency with component-based filtering", () => {
      withEnvironment({
        "LOG_KEY": "aggregation-processing,schema-validation",
        "LOG_LEVEL": "debug",
        "DENO_TESTING": "true",
      }, () => {
        // Test that specific components can be debugged
        const aggregationLogger = createEnhancedDebugLogger(
          "aggregation-processing",
        );
        const schemaLogger = createEnhancedDebugLogger("schema-validation");
        const otherLogger = createEnhancedDebugLogger("other-component");

        assert(aggregationLogger.ok && schemaLogger.ok && otherLogger.ok);

        if (aggregationLogger.ok && schemaLogger.ok && otherLogger.ok) {
          // Aggregation should log
          aggregationLogger.data.debug("aggregation debug message");
          assertEquals(logOutputs.length, 1);

          // Schema should log
          schemaLogger.data.debug("schema debug message");
          assertEquals(logOutputs.length, 2);

          // Other should not log (filtered)
          const otherResult = otherLogger.data.debug("other debug message");
          assertFalse(otherResult.ok);
          assertEquals(logOutputs.length, 2); // No new log
        }
      });
    });

    it("should provide unified logging architecture", () => {
      withEnvironment({ "DENO_TESTING": "true" }, () => {
        const logger = createEnhancedDebugLogger("unified-test");
        assert(logger.ok);

        if (logger.ok) {
          // Standard DebugLogger interface
          logger.data.info("Standard info message");
          assertEquals(logOutputs.length, 1);

          // All messages should have consistent format
          logOutputs.forEach((output) => {
            assert(output.includes("[unified-test]"));
            assert(output.includes("ℹ️"));
          });
        }
      });
    });
  });
});
