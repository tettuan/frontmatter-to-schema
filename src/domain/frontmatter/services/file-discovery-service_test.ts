import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { FileDiscoveryService } from "./file-discovery-service.ts";
import { err, ok } from "../../shared/types/result.ts";
import { createError } from "../../shared/types/errors.ts";
import { ProcessingBoundsFactory } from "../../shared/types/processing-bounds.ts";
import type { DomainFileLister } from "../../shared/interfaces/file-operations.ts";
import type {
  DebugLogger,
  LogContext,
  LogLevel,
} from "../../shared/services/debug-logger.ts";

describe("FileDiscoveryService", () => {
  // Helper function to create mock dependencies
  function createMockFileLister(files: string[] = ["test1.md", "test2.md"]) {
    return {
      list: (pattern: string) => {
        if (pattern === "error-pattern") {
          return err(createError({
            kind: "FileNotFound",
            path: pattern,
          }));
        }
        return ok(files);
      },
    } as DomainFileLister;
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
        // Return a new logger with the provided context
        return this;
      },
      getLogs: () => logs,
    };
  }

  describe("Smart Constructor", () => {
    it("should create service with valid configuration", () => {
      const config = {
        fileLister: createMockFileLister(),
      };

      const result = FileDiscoveryService.create(config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should return error with missing fileLister", () => {
      const config = {
        fileLister: null as any,
      };

      const result = FileDiscoveryService.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: DomainFileLister is required for file discovery operations",
        );
      }
    });

    it("should return error with undefined fileLister", () => {
      const config = {
        fileLister: undefined as any,
      };

      const result = FileDiscoveryService.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
      }
    });
  });

  describe("File Discovery Operations", () => {
    it("should discover files successfully with default bounds", () => {
      const mockFiles = ["file1.md", "file2.md", "file3.md"];
      const fileLister = createMockFileLister(mockFiles);
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "*.md",
      };

      const result = service.discoverFiles(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.files, mockFiles);
        assertEquals(result.data.fileCount, 3);
        assertEquals(result.data.boundsType, "bounded");
        assertExists(result.data.boundsMonitor);
      }

      // Verify logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) => log.message.includes("Starting file discovery")),
        true,
      );
      assertEquals(
        logs.some((log) => log.message.includes("Found 3 files to process")),
        true,
      );
      assertEquals(
        logs.some((log) =>
          log.message.includes("Initialized processing bounds")
        ),
        true,
      );
    });

    it("should use provided processing bounds", () => {
      const mockFiles = ["file1.md"];
      const fileLister = createMockFileLister(mockFiles);
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      // Create custom bounds
      const boundsResult = ProcessingBoundsFactory.createBounded(100, 50, 30);
      assertEquals(boundsResult.ok, true);
      if (!boundsResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "*.md",
        processingBounds: boundsResult.data,
      };

      const result = service.discoverFiles(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.files, mockFiles);
        assertEquals(result.data.fileCount, 1);
        assertEquals(result.data.boundsType, "bounded");
      }
    });

    it("should handle empty file list", () => {
      const fileLister = createMockFileLister([]);
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "nonexistent-*.md",
      };

      const result = service.discoverFiles(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.files, []);
        assertEquals(result.data.fileCount, 0);
        assertExists(result.data.boundsMonitor);
      }
    });

    it("should handle file listing errors", () => {
      const fileLister = createMockFileLister();
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "error-pattern",
      };

      const result = service.discoverFiles(options, logger);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
        // Type narrowing to access path property
        if (result.error.kind === "FileNotFound") {
          assertEquals(result.error.path, "error-pattern");
        }
      }

      // Verify error logging
      const logs = logger.getLogs();
      assertEquals(
        logs.some((log) =>
          log.level === "error" &&
          log.message.includes("Failed to list files with pattern")
        ),
        true,
      );
    });

    it("should handle large file count", () => {
      const largeFileList = Array.from(
        { length: 1000 },
        (_, i) => `file${i}.md`,
      );
      const fileLister = createMockFileLister(largeFileList);
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "*.md",
      };

      const result = service.discoverFiles(options, logger);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.files.length, 1000);
        assertEquals(result.data.fileCount, 1000);
        assertExists(result.data.boundsMonitor);
      }
    });
  });

  describe("Discovery Statistics", () => {
    it("should calculate basic statistics", () => {
      const fileLister = createMockFileLister();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const files = [
        "/path/to/file1.md",
        "/path/to/file2.md",
        "/different/path/file3.md",
      ];

      const stats = service.getDiscoveryStats(files);

      assertEquals(stats.fileCount, 3);
      assertEquals(stats.distinctDirectories, 2); // /path/to and /different/path
      assertEquals(typeof stats.averagePathLength, "number");
      assertEquals(stats.averagePathLength > 0, true);
    });

    it("should handle single file statistics", () => {
      const fileLister = createMockFileLister();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const files = ["/single/file.md"];

      const stats = service.getDiscoveryStats(files);

      assertEquals(stats.fileCount, 1);
      assertEquals(stats.distinctDirectories, 1);
      assertEquals(stats.averagePathLength, 15); // length of "/single/file.md"
    });

    it("should handle empty file list statistics", () => {
      const fileLister = createMockFileLister();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const files: string[] = [];

      const stats = service.getDiscoveryStats(files);

      assertEquals(stats.fileCount, 0);
      assertEquals(stats.distinctDirectories, 0);
      assertEquals(isNaN(stats.averagePathLength), true); // 0/0 = NaN
    });
  });

  describe("Error Handling Patterns", () => {
    it("should follow Totality principles - Result<T,E> pattern", () => {
      const config = { fileLister: null as any };
      const result = FileDiscoveryService.create(config);

      // Verify Result type structure
      assertEquals(typeof result.ok, "boolean");
      if (!result.ok) {
        assertExists(result.error);
        assertEquals(typeof result.error.kind, "string");
        assertEquals(typeof result.error.message, "string");
      }
    });

    it("should provide detailed error context", () => {
      const fileLister = createMockFileLister();
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "error-pattern",
      };

      const result = service.discoverFiles(options, logger);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
      }
    });
  });

  describe("Logging Integration", () => {
    it("should log discovery operations", () => {
      const fileLister = createMockFileLister(["test.md"]);
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "*.md",
      };

      service.discoverFiles(options, logger);

      const logs = logger.getLogs();
      const debugLogs = logs.filter((log) => log.level === "debug");
      const infoLogs = logs.filter((log) => log.level === "info");

      assertEquals(debugLogs.length >= 2, true); // Start + bounds initialization
      assertEquals(infoLogs.length >= 1, true); // File count
    });

    it("should include relevant context in logs", () => {
      const fileLister = createMockFileLister(["test.md"]);
      const logger = createMockLogger();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const options = {
        pattern: "*.md",
      };

      service.discoverFiles(options, logger);

      const logs = logger.getLogs();
      const contextLogs = logs.filter((log) => log.context?.operation);

      assertEquals(contextLogs.length > 0, true);
      assertEquals(
        contextLogs.some((log) => log.context.operation === "file-discovery"),
        true,
      );
    });
  });

  describe("DDD Architecture Compliance", () => {
    it("should maintain domain boundaries", () => {
      const config = {
        fileLister: createMockFileLister(),
      };

      const result = FileDiscoveryService.create(config);
      assertEquals(result.ok, true);

      if (result.ok) {
        // Service should only depend on domain interfaces
        assertExists(result.data);
        assertEquals(typeof result.data.discoverFiles, "function");
        assertEquals(typeof result.data.getDiscoveryStats, "function");
      }
    });

    it("should follow single responsibility principle", () => {
      const fileLister = createMockFileLister();

      const serviceResult = FileDiscoveryService.create({ fileLister });
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;

      // Service should have focused, cohesive interface
      const methods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(service),
      );
      const publicMethods = methods.filter((name) =>
        name !== "constructor" && typeof (service as any)[name] === "function"
      );

      assertEquals(publicMethods.length, 2); // discoverFiles and getDiscoveryStats
    });
  });
});
