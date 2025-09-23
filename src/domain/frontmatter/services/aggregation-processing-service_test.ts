import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  AggregationProcessingService,
  AggregationService,
  BasePropertyPopulator,
} from "./aggregation-processing-service.ts";
import { err, ok } from "../../shared/types/result.ts";
import { createError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
// DerivationRule is used in type annotations for interfaces
import { MergeOperations } from "../utilities/merge-operations.ts";
import type {
  DebugLogger,
  LogContext,
  LogLevel,
} from "../../shared/services/debug-logger.ts";

describe("AggregationProcessingService", () => {
  // Helper function to create mock dependencies
  function createMockAggregationService(
    shouldFail = false,
    failureStage?: "aggregate" | "merge",
  ): AggregationService {
    return {
      aggregate: (_data, rules, baseData) => {
        if (shouldFail && failureStage === "aggregate") {
          return err(createError({
            kind: "AggregationFailed",
            message: "Mock aggregation failure",
          }));
        }

        // Mock successful aggregation - return merged base data with some transformation
        const result = FrontmatterData.create({
          ...baseData.getData(),
          _aggregated: true,
          _rulesApplied: rules.length,
        });

        return result.ok ? ok(result.data) : result;
      },

      mergeWithBase: (data) => {
        if (shouldFail && failureStage === "merge") {
          return err(createError({
            kind: "AggregationFailed",
            message: "Mock merge failure",
          }));
        }

        // Mock successful merge
        const merged = FrontmatterData.create({
          ...data.getData(),
          _merged: true,
        });

        return merged.ok ? ok(merged.data) : merged;
      },
    };
  }

  function createMockBasePropertyPopulator(
    shouldFail = false,
  ): BasePropertyPopulator {
    return {
      populateFromSchema: (data, _schema) => {
        if (shouldFail) {
          return err(createError({
            kind: "AggregationFailed",
            message: "Mock base property population failure",
          }));
        }

        // Mock successful base property population
        const populated = FrontmatterData.create({
          ...data.getData(),
          _basePropertiesPopulated: true,
        });

        return populated.ok ? ok(populated.data) : populated;
      },
    };
  }

  function createMockMergeOperations(shouldFail = false): MergeOperations {
    return {
      mergeDataDirectly: (data) => {
        if (shouldFail) {
          return err(createError({
            kind: "AggregationFailed",
            message: "Mock direct merge failure",
          }));
        }

        if (data.length === 0) {
          const empty = FrontmatterData.create({});
          return empty.ok ? ok(empty.data) : empty;
        }

        // Merge all data into first item
        const mergedData = data.reduce((acc, item) => ({
          ...acc,
          ...item.getData(),
        }), {});

        const result = FrontmatterData.create(mergedData);
        return result.ok ? ok(result.data) : result;
      },
    } as MergeOperations;
  }

  function createMockSchema(
    derivationRules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }> = [],
    hasFrontmatterPart = true,
  ): Schema {
    return {
      getDerivedRules: () => derivationRules,
      findFrontmatterPartSchema: () => {
        if (hasFrontmatterPart) {
          return ok({ type: "object", properties: {} });
        }
        return err(createError({
          kind: "SchemaNotFound",
          path: "x-frontmatter-part",
        }));
      },
      findFrontmatterPartPath: () => {
        if (hasFrontmatterPart) {
          return ok("x-frontmatter-part");
        }
        return err(createError({
          kind: "SchemaNotFound",
          path: "x-frontmatter-part",
        }));
      },
    } as Schema;
  }

  function createMockFrontmatterData(
    data: Record<string, any>,
  ): FrontmatterData {
    const result = FrontmatterData.create(data);
    if (!result.ok) throw new Error("Failed to create mock FrontmatterData");
    return result.data;
  }

  function createMockLogger(): DebugLogger & {
    getLogs: () => Array<{ level: string; message: string; context?: any }>;
  } {
    const logs: Array<{ level: string; message: string; context?: any }> = [];

    return {
      log: (level: LogLevel, message: string, context?: LogContext) => {
        logs.push({ level: level.kind, message, context });
        return ok(undefined);
      },
      debug: (message: string, context?: LogContext) => {
        logs.push({ level: "debug", message, context });
        return ok(undefined);
      },
      info: (message: string, context?: LogContext) => {
        logs.push({ level: "info", message, context });
        return ok(undefined);
      },
      warn: (message: string, context?: LogContext) => {
        logs.push({ level: "warn", message, context });
        return ok(undefined);
      },
      error: (message: string, context?: LogContext) => {
        logs.push({ level: "error", message, context });
        return ok(undefined);
      },
      trace: (message: string, context?: LogContext) => {
        logs.push({ level: "trace", message, context });
        return ok(undefined);
      },
      withContext: function (_context: LogContext) {
        return this;
      },
      getLogs: () => logs,
    };
  }

  describe("Smart Constructor", () => {
    it("should create service with valid configuration", () => {
      const config = {
        aggregator: createMockAggregationService(),
        basePropertyPopulator: createMockBasePropertyPopulator(),
        mergeOperations: createMockMergeOperations(),
      };

      const result = AggregationProcessingService.create(config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should return error with missing aggregator", () => {
      const config = {
        aggregator: null as any,
        basePropertyPopulator: createMockBasePropertyPopulator(),
        mergeOperations: createMockMergeOperations(),
      };

      const result = AggregationProcessingService.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: AggregationService is required for data aggregation operations",
        );
      }
    });

    it("should return error with missing basePropertyPopulator", () => {
      const config = {
        aggregator: createMockAggregationService(),
        basePropertyPopulator: null as any,
        mergeOperations: createMockMergeOperations(),
      };

      const result = AggregationProcessingService.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: BasePropertyPopulator is required for base property population",
        );
      }
    });

    it("should return error with missing mergeOperations", () => {
      const config = {
        aggregator: createMockAggregationService(),
        basePropertyPopulator: createMockBasePropertyPopulator(),
        mergeOperations: null as any,
      };

      const result = AggregationProcessingService.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: MergeOperations is required for data merging operations",
        );
      }
    });
  });

  describe("Aggregation with Derivation Rules", () => {
    it("should process aggregation with derivation rules successfully", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [
        createMockFrontmatterData({ name: "test1", value: 1 }),
        createMockFrontmatterData({ name: "test2", value: 2 }),
      ];
      const mockSchema = createMockSchema([
        { sourcePath: "name", targetField: "names", unique: true },
        { sourcePath: "value", targetField: "total", unique: false },
      ]);
      const logger = createMockLogger();

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      const result = service.aggregateAndPopulateBaseProperties(
        options,
        logger,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.derivationRulesApplied, 2);
        assertEquals(result.data.basePropertiesPopulated, true);
        assertEquals(result.data.processingMethod, "with-derivation-rules");
        assertExists(result.data.aggregatedData);
      }

      // Verify logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.message.includes(
            "Starting data aggregation with derivation rules",
          )
        ),
        true,
      );
      assertEquals(
        logs.some((log) => log.message.includes("Found 2 derivation rules")),
        true,
      );
    });

    it("should handle empty data with derivation rules", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockSchema = createMockSchema([
        { sourcePath: "name", targetField: "names", unique: true },
      ]);

      const options = {
        data: [],
        schema: mockSchema,
      };

      // Mock SchemaPathResolver for empty structure creation
      const result = service.aggregateAndPopulateBaseProperties(options);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.derivationRulesApplied, 1);
        assertEquals(result.data.processingMethod, "with-derivation-rules");
      }
    });

    it("should handle aggregation failure gracefully", () => {
      const aggregator = createMockAggregationService(true, "aggregate");
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [createMockFrontmatterData({ test: "data" })];
      const mockSchema = createMockSchema([
        { sourcePath: "test", targetField: "tests", unique: true },
      ]);
      const logger = createMockLogger();

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      const result = service.aggregateAndPopulateBaseProperties(
        options,
        logger,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
      }

      // Verify error logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.level === "error" &&
          log.message.includes("Data aggregation failed")
        ),
        true,
      );
    });
  });

  describe("Aggregation without Derivation Rules", () => {
    it("should process aggregation without derivation rules successfully", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [
        createMockFrontmatterData({ name: "test1" }),
        createMockFrontmatterData({ name: "test2" }),
      ];
      const mockSchema = createMockSchema([]); // No derivation rules
      const logger = createMockLogger();

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      const result = service.aggregateAndPopulateBaseProperties(
        options,
        logger,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.derivationRulesApplied, 0);
        assertEquals(result.data.basePropertiesPopulated, true);
        assertEquals(result.data.processingMethod, "without-derivation-rules");
        assertExists(result.data.aggregatedData);
      }

      // Verify logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) => log.message.includes("Found 0 derivation rules")),
        true,
      );
    });

    it("should use direct merge when no frontmatter-part schema exists", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [createMockFrontmatterData({ test: "data" })];
      const mockSchema = createMockSchema([], false); // No frontmatter-part schema
      const logger = createMockLogger();

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      const result = service.aggregateAndPopulateBaseProperties(
        options,
        logger,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.processingMethod, "without-derivation-rules");
      }

      // Verify fallback logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.message.includes(
            "No frontmatter-part schema found, using direct merge",
          )
        ),
        true,
      );
    });
  });

  describe("Base Property Population", () => {
    it("should handle base property population failure", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator(true);
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [createMockFrontmatterData({ test: "data" })];
      const mockSchema = createMockSchema([]);
      const logger = createMockLogger();

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      const result = service.aggregateAndPopulateBaseProperties(
        options,
        logger,
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
      }

      // Verify error logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.level === "error" &&
          log.message.includes("Base property population failed")
        ),
        true,
      );
    });
  });

  describe("Aggregation Statistics", () => {
    it("should calculate aggregation statistics correctly", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [
        createMockFrontmatterData({ test1: "data1" }),
        createMockFrontmatterData({ test2: "data2" }),
      ];
      const mockSchema = createMockSchema([
        { sourcePath: "test", targetField: "tests", unique: true },
      ]);

      const stats = service.getAggregationStats(mockData, mockSchema);

      assertEquals(stats.dataCount, 2);
      assertEquals(stats.derivationRulesCount, 1);
      assertEquals(stats.hasFrontmatterPartSchema, true);
      assertEquals(stats.processingMethod, "with-derivation-rules");
    });

    it("should calculate statistics for no derivation rules scenario", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [createMockFrontmatterData({ test: "data" })];
      const mockSchema = createMockSchema([], false);

      const stats = service.getAggregationStats(mockData, mockSchema);

      assertEquals(stats.dataCount, 1);
      assertEquals(stats.derivationRulesCount, 0);
      assertEquals(stats.hasFrontmatterPartSchema, false);
      assertEquals(stats.processingMethod, "without-derivation-rules");
    });
  });

  describe("Error Handling Patterns", () => {
    it("should follow Totality principles - Result<T,E> pattern", () => {
      const config = {
        aggregator: null as any,
        basePropertyPopulator: null as any,
        mergeOperations: null as any,
      };
      const result = AggregationProcessingService.create(config);

      // Verify Result type structure
      assertEquals(typeof result.ok, "boolean");
      if (!result.ok) {
        assertExists(result.error);
        assertEquals(typeof result.error.kind, "string");
        assertEquals(typeof result.error.message, "string");
      }
    });

    it("should provide detailed error context", () => {
      const aggregator = createMockAggregationService(true, "merge");
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [createMockFrontmatterData({ test: "data" })];
      const mockSchema = createMockSchema([
        { sourcePath: "test", targetField: "tests", unique: true },
      ]);

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      const result = service.aggregateAndPopulateBaseProperties(options);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
      }
    });
  });

  describe("Logging Integration", () => {
    it("should log aggregation operations comprehensively", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [createMockFrontmatterData({ test: "data" })];
      const mockSchema = createMockSchema([]);
      const logger = createMockLogger();

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      service.aggregateAndPopulateBaseProperties(options, logger);

      const logs = logger.getLogs();

      // Verify comprehensive logging
      assertEquals(
        logs.some((log) =>
          log.message.includes(
            "Starting data aggregation with derivation rules",
          )
        ),
        true,
      );
      assertEquals(
        logs.some((log) => log.message.includes("Found 0 derivation rules")),
        true,
      );
      assertEquals(
        logs.some((log) =>
          log.message.includes("Starting base property population")
        ),
        true,
      );
      assertEquals(
        logs.some((log) =>
          log.message.includes(
            "Aggregation and base property population completed successfully",
          )
        ),
        true,
      );
    });

    it("should include relevant context in logs", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const mockData = [createMockFrontmatterData({ test: "data" })];
      const mockSchema = createMockSchema([
        { sourcePath: "test", targetField: "tests", unique: true },
      ]);
      const logger = createMockLogger();

      const options = {
        data: mockData,
        schema: mockSchema,
      };

      service.aggregateAndPopulateBaseProperties(options, logger);

      const logs = logger.getLogs();
      const contextLogs = logs.filter((log) => log.context?.operation);

      assertEquals(contextLogs.length > 0, true);
      assertEquals(
        contextLogs.some((log) => log.context.operation === "aggregation"),
        true,
      );
    });
  });

  describe("DDD Architecture Compliance", () => {
    it("should maintain domain boundaries", () => {
      const config = {
        aggregator: createMockAggregationService(),
        basePropertyPopulator: createMockBasePropertyPopulator(),
        mergeOperations: createMockMergeOperations(),
      };

      const result = AggregationProcessingService.create(config);
      assertEquals(result.ok, true);

      if (result.ok) {
        // Service should only depend on domain interfaces
        assertExists(result.data);
        assertEquals(
          typeof result.data.aggregateAndPopulateBaseProperties,
          "function",
        );
        assertEquals(typeof result.data.getAggregationStats, "function");
      }
    });

    it("should follow single responsibility principle", () => {
      const aggregator = createMockAggregationService();
      const basePropertyPopulator = createMockBasePropertyPopulator();
      const mergeOperations = createMockMergeOperations();

      const serviceResult = AggregationProcessingService.create({
        aggregator,
        basePropertyPopulator,
        mergeOperations,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;

      // Service should have focused, cohesive interface
      const methods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(service),
      );
      const publicMethods = methods.filter((name) =>
        name !== "constructor" &&
        !name.startsWith("_") && // Exclude private methods
        typeof (service as any)[name] === "function"
      );

      // Should have core public methods: aggregateAndPopulateBaseProperties and getAggregationStats
      assertEquals(
        publicMethods.includes("aggregateAndPopulateBaseProperties"),
        true,
      );
      assertEquals(publicMethods.includes("getAggregationStats"), true);
    });
  });
});
