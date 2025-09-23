import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  DocumentProcessor,
  ProcessingStrategyService,
} from "./processing-strategy-service.ts";
import { err, ok } from "../../shared/types/result.ts";
import { createError } from "../../shared/types/errors.ts";
import {
  ProcessingBoundsFactory,
  ProcessingBoundsMonitor,
} from "../../shared/types/processing-bounds.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import { ProcessingOptionsFactory } from "../configuration/processing-options-factory.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { FilePath } from "../value-objects/file-path.ts";
import type {
  DebugLogger,
  LogContext,
  LogLevel,
} from "../../shared/services/debug-logger.ts";

describe("ProcessingStrategyService", () => {
  // Helper function to create mock dependencies
  function createMockPerformanceSettings(
    minFilesForParallel = 10,
    defaultMaxWorkers = 4,
  ): PerformanceSettings {
    return {
      getMinFilesForParallel: () => minFilesForParallel,
      getDefaultMaxWorkers: () => defaultMaxWorkers,
    } as PerformanceSettings;
  }

  function createMockDocumentProcessor(
    shouldFail = false,
    failurePattern?: string,
  ): DocumentProcessor {
    return {
      processDocument: (
        filePath: string,
        _validationRules: ValidationRules,
        _logger?: DebugLogger,
      ) => {
        if (
          shouldFail || (failurePattern && filePath.includes(failurePattern))
        ) {
          return err(createError({
            kind: "PipelineExecutionError",
            content: `Failed to process ${filePath}`,
          }));
        }

        const mockFrontmatterData = FrontmatterData.create({
          test: "data",
          filePath,
        });
        if (!mockFrontmatterData.ok) {
          return err(createError({
            kind: "PipelineExecutionError",
            content: "Failed to create mock frontmatter data",
          }));
        }

        // Create FilePath value object for the document
        const filePathResult = FilePath.create(filePath);
        if (!filePathResult.ok) {
          return err(createError({
            kind: "PipelineExecutionError",
            content: "Failed to create file path",
          }));
        }

        const mockDocument = MarkdownDocument.create(
          filePathResult.data,
          "test content",
          mockFrontmatterData.data,
          "test body",
        );
        if (!mockDocument.ok) {
          return err(createError({
            kind: "PipelineExecutionError",
            content: "Failed to create mock document",
          }));
        }

        return ok({
          frontmatterData: mockFrontmatterData.data,
          document: mockDocument.data,
        });
      },
    };
  }

  function createMockValidationRules(): ValidationRules {
    return ValidationRules.create([]);
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
        performanceSettings: createMockPerformanceSettings(),
        documentProcessor: createMockDocumentProcessor(),
      };

      const result = ProcessingStrategyService.create(config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should return error with missing performanceSettings", () => {
      const config = {
        performanceSettings: null as any,
        documentProcessor: createMockDocumentProcessor(),
      };

      const result = ProcessingStrategyService.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: PerformanceSettings is required for processing strategy decisions",
        );
      }
    });

    it("should return error with missing documentProcessor", () => {
      const config = {
        performanceSettings: createMockPerformanceSettings(),
        documentProcessor: null as any,
      };

      const result = ProcessingStrategyService.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: DocumentProcessor is required for document processing operations",
        );
      }
    });
  });

  describe("Strategy Decision Logic", () => {
    it("should select sequential strategy for small file count", async () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(5);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const options = {
        files: ["file1.md", "file2.md", "file3.md"],
        validationRules: createMockValidationRules(),
        boundsMonitor,
        legacyOptions: { parallel: true, maxWorkers: 4 },
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.strategy, "sequential");
        assertEquals(result.data.processedData.length, 3);
        assertEquals(result.data.documents.length, 3);
        assertEquals(result.data.workerCount, undefined);
      }

      // Verify logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.message.includes("Selected sequential processing strategy")
        ),
        true,
      );
    });

    it("should select parallel strategy for large file count", async () => {
      const performanceSettings = createMockPerformanceSettings(5, 4);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(10);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const files = Array.from({ length: 10 }, (_, i) => `file${i}.md`);
      const options = {
        files,
        validationRules: createMockValidationRules(),
        boundsMonitor,
        legacyOptions: { parallel: true, maxWorkers: 4 },
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.strategy, "parallel");
        assertEquals(result.data.processedData.length, 10);
        assertEquals(result.data.documents.length, 10);
        assertEquals(result.data.workerCount, 4);
      }

      // Verify logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.message.includes("Selected parallel processing strategy")
        ),
        true,
      );
    });

    it("should use adaptive strategy when provided", async () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(15);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      // Create adaptive processing options
      const adaptiveOptions = ProcessingOptionsFactory.createAdaptive(8, 12);

      const files = Array.from({ length: 15 }, (_, i) => `file${i}.md`);
      const options = {
        files,
        validationRules: createMockValidationRules(),
        boundsMonitor,
        processingOptionsState: adaptiveOptions,
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.strategy, "parallel"); // 15 > 12 threshold
        assertEquals(result.data.processedData.length, 15);
        assertEquals(result.data.workerCount, 8); // baseWorkers
      }

      // Verify adaptive strategy logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.message.includes("Using adaptive processing strategy")
        ),
        true,
      );
    });
  });

  describe("Sequential Processing", () => {
    it("should process files sequentially with success", async () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(5);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const options = {
        files: ["test1.md", "test2.md"],
        validationRules: createMockValidationRules(),
        boundsMonitor,
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.strategy, "sequential");
        assertEquals(result.data.processedData.length, 2);
        assertEquals(result.data.documents.length, 2);
      }

      // Verify sequential processing logs
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.message.includes("Starting sequential document processing")
        ),
        true,
      );
      assertEquals(
        logs.some((log) =>
          log.message.includes("Sequential processing completed")
        ),
        true,
      );
    });

    it("should handle processing failures gracefully", async () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor(false, "fail");

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(5);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const options = {
        files: ["success.md", "fail.md", "success2.md"],
        validationRules: createMockValidationRules(),
        boundsMonitor,
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.strategy, "sequential");
        assertEquals(result.data.processedData.length, 2); // Only successful files
        assertEquals(result.data.documents.length, 2);
      }

      // Verify error logging for failed file
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.level === "error" &&
          log.message.includes("Failed to process file: fail.md")
        ),
        true,
      );
    });

    it("should handle memory bounds violations", async () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      // Create very restrictive bounds to trigger violation
      const boundsResult = ProcessingBoundsFactory.createBounded(2, 1, 1);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const options = {
        files: ["test1.md", "test2.md", "test3.md"],
        validationRules: createMockValidationRules(),
        boundsMonitor,
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MemoryBoundsViolation");
      }
    });
  });

  describe("Parallel Processing", () => {
    it("should process files in parallel with success", async () => {
      const performanceSettings = createMockPerformanceSettings(5, 2);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(10);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const files = Array.from({ length: 8 }, (_, i) => `file${i}.md`);
      const options = {
        files,
        validationRules: createMockValidationRules(),
        boundsMonitor,
        legacyOptions: { parallel: true, maxWorkers: 2 },
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.strategy, "parallel");
        assertEquals(result.data.processedData.length, 8);
        assertEquals(result.data.documents.length, 8);
        assertEquals(result.data.workerCount, 2);
      }

      // Verify parallel processing logs
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.message.includes("Starting parallel document processing")
        ),
        true,
      );
      assertEquals(
        logs.some((log) =>
          log.message.includes("Parallel processing completed")
        ),
        true,
      );
    });

    it("should handle mixed success/failure in parallel processing", async () => {
      const performanceSettings = createMockPerformanceSettings(5, 2);
      const documentProcessor = createMockDocumentProcessor(false, "fail");

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(10);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const files = [
        "success1.md",
        "fail1.md",
        "success2.md",
        "fail2.md",
        "success3.md",
      ];
      const options = {
        files,
        validationRules: createMockValidationRules(),
        boundsMonitor,
        legacyOptions: { parallel: true, maxWorkers: 2 },
      };

      const result = await service.processDocuments(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.strategy, "parallel");
        assertEquals(result.data.processedData.length, 3); // Only successful files
        assertEquals(result.data.documents.length, 3);
      }

      // Verify mixed results logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) => log.message.includes("3 successful, 2 failed")),
        true,
      );
    });
  });

  describe("Strategy Statistics", () => {
    it("should calculate strategy statistics", () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;

      // Test with default settings
      const stats1 = service.getStrategyStats(5);
      assertEquals(stats1.recommendedStrategy, "sequential");
      assertEquals(stats1.minFilesForParallel, 10);
      assertEquals(stats1.defaultMaxWorkers, 4);
      assertEquals(stats1.adaptiveThreshold, undefined);

      const stats2 = service.getStrategyStats(15);
      assertEquals(stats2.recommendedStrategy, "parallel");

      // Test with adaptive options
      const adaptiveOptions = ProcessingOptionsFactory.createAdaptive(8, 12);

      const stats3 = service.getStrategyStats(10, adaptiveOptions);
      assertEquals(stats3.recommendedStrategy, "sequential"); // 10 <= 12
      assertEquals(stats3.adaptiveThreshold, 12);

      const stats4 = service.getStrategyStats(15, adaptiveOptions);
      assertEquals(stats4.recommendedStrategy, "parallel"); // 15 > 12
    });
  });

  describe("Error Handling Patterns", () => {
    it("should follow Totality principles - Result<T,E> pattern", () => {
      const config = {
        performanceSettings: null as any,
        documentProcessor: null as any,
      };
      const result = ProcessingStrategyService.create(config);

      // Verify Result type structure
      assertEquals(typeof result.ok, "boolean");
      if (!result.ok) {
        assertExists(result.error);
        assertEquals(typeof result.error.kind, "string");
        assertEquals(typeof result.error.message, "string");
      }
    });

    it("should handle no valid documents scenario", async () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor(true); // All files fail

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(5);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);

      const options = {
        files: ["test1.md", "test2.md"],
        validationRules: createMockValidationRules(),
        boundsMonitor,
      };

      const result = await service.processDocuments(options);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "AggregationFailed");
        assertEquals(
          result.error.message.includes("No valid documents found"),
          true,
        );
      }
    });
  });

  describe("Logging Integration", () => {
    it("should log strategy decisions and processing operations", async () => {
      const performanceSettings = createMockPerformanceSettings(10, 4);
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
      });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const boundsResult = ProcessingBoundsFactory.createDefault(5);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const boundsMonitor = ProcessingBoundsMonitor.create(boundsResult.data);
      const logger = createMockLogger();

      const options = {
        files: ["test.md"],
        validationRules: createMockValidationRules(),
        boundsMonitor,
      };

      await service.processDocuments(options, logger);

      const logs = logger.getLogs();

      // Verify strategy evaluation logging
      assertEquals(
        logs.some((log) =>
          log.message.includes(
            "Starting document processing strategy evaluation",
          )
        ),
        true,
      );

      // Verify context includes relevant operation metadata
      const contextLogs = logs.filter((log) => log.context?.operation);
      assertEquals(contextLogs.length > 0, true);
      assertEquals(
        contextLogs.some((log) =>
          log.context.operation === "processing-strategy"
        ),
        true,
      );
    });
  });

  describe("DDD Architecture Compliance", () => {
    it("should maintain domain boundaries", () => {
      const config = {
        performanceSettings: createMockPerformanceSettings(),
        documentProcessor: createMockDocumentProcessor(),
      };

      const result = ProcessingStrategyService.create(config);
      assertEquals(result.ok, true);

      if (result.ok) {
        // Service should only depend on domain interfaces
        assertExists(result.data);
        assertEquals(typeof result.data.processDocuments, "function");
        assertEquals(typeof result.data.getStrategyStats, "function");
      }
    });

    it("should follow single responsibility principle", () => {
      const performanceSettings = createMockPerformanceSettings();
      const documentProcessor = createMockDocumentProcessor();

      const serviceResult = ProcessingStrategyService.create({
        performanceSettings,
        documentProcessor,
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

      // Should have core public methods: processDocuments and getStrategyStats
      assertEquals(publicMethods.includes("processDocuments"), true);
      assertEquals(publicMethods.includes("getStrategyStats"), true);
    });
  });
});
