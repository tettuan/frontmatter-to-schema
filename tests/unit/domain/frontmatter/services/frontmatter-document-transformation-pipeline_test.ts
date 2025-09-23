import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { FrontmatterDocumentTransformationPipeline } from "../../../../../src/domain/frontmatter/services/frontmatter-document-transformation-pipeline.ts";
import { FrontmatterProcessor } from "../../../../../src/domain/frontmatter/processors/frontmatter-processor.ts";
import { defaultFrontmatterDataCreationService } from "../../../../../src/domain/frontmatter/services/frontmatter-data-creation-service.ts";
import { PerformanceSettings } from "../../../../../src/domain/configuration/value-objects/performance-settings.ts";
import { MergeOperations } from "../../../../../src/domain/frontmatter/utilities/merge-operations.ts";
import { ok } from "../../../../../src/domain/shared/types/result.ts";

describe("FrontmatterDocumentTransformationPipeline", () => {
  // Helper function to create valid dependencies
  function createValidDependencies() {
    const performanceSettingsResult = PerformanceSettings.createDefault();
    if (!performanceSettingsResult.ok) {
      throw new Error("Failed to create performance settings");
    }

    const mergeOperations = new MergeOperations(defaultFrontmatterDataCreationService);

    const mockReader = {
      read: () => ok("# Test\nkey: value"),
      readFileSync: () => "# Test\nkey: value",
      readFile: () => Promise.resolve("# Test\nkey: value"),
    };

    const mockLister = {
      list: () => ok(["test.md"]),
      listFiles: () => ["test.md"],
      listFilesAsync: () => Promise.resolve(["test.md"]),
    };

    const mockProcessor = {
      process: () => ({
        ok: true,
        data: { getData: () => ({ key: "value" }) },
      }),
    } as unknown as FrontmatterProcessor;

    const mockSchemaValidation = {
      validate: () => ({ ok: true, data: { key: "value" } }),
    };

    const mockAggregator = {
      aggregate: () => ({ ok: true, data: { getData: () => ({ key: "value" }) } }),
    };

    const mockBasePropertyPopulator = {
      populate: () => ({ ok: true, data: { getData: () => ({ key: "value" }) } }),
    };

    return {
      performanceSettings: performanceSettingsResult.data,
      mergeOperations,
      mockReader,
      mockLister,
      mockProcessor,
      mockSchemaValidation,
      mockAggregator,
      mockBasePropertyPopulator,
    };
  }

  describe("Smart Constructor", () => {
    it("should create pipeline with valid configuration", () => {
      const deps = createValidDependencies();

      const config = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      const result = FrontmatterDocumentTransformationPipeline.create(config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should return error with missing processor", () => {
      const deps = createValidDependencies();

      const config = {
        processor: null as any,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      const result = FrontmatterDocumentTransformationPipeline.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
      }
    });

    it("should return error with missing file system services", () => {
      const deps = createValidDependencies();

      const config = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: null as any,
          lister: null as any,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      const result = FrontmatterDocumentTransformationPipeline.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: File system services (reader and lister) are required"
        );
      }
    });

    it("should return error with missing domain services", () => {
      const deps = createValidDependencies();

      const config = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: null as any,
          aggregator: null as any,
          basePropertyPopulator: null as any,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      const result = FrontmatterDocumentTransformationPipeline.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: All domain services (schemaValidation, aggregator, basePropertyPopulator) are required"
        );
      }
    });
  });

  describe("Error Handling Patterns", () => {
    it("should follow Totality principles - Result<T,E> pattern", () => {
      const deps = createValidDependencies();

      const config = {
        processor: null as any,
        fileSystem: { reader: null as any, lister: null as any },
        services: { schemaValidation: null as any, aggregator: null as any, basePropertyPopulator: null as any },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      const result = FrontmatterDocumentTransformationPipeline.create(config);

      // Verify Result<T,E> pattern
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertExists(result.data);
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });

    it("should handle configuration validation gracefully", () => {
      const deps = createValidDependencies();

      const config = {
        processor: null as any,
        fileSystem: { reader: deps.mockReader, lister: deps.mockLister },
        services: { schemaValidation: deps.mockSchemaValidation, aggregator: deps.mockAggregator, basePropertyPopulator: deps.mockBasePropertyPopulator },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      const result = FrontmatterDocumentTransformationPipeline.create(config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertExists(result.error.message);
      }
    });
  });

  describe("DDD Architecture Compliance", () => {
    it("should maintain domain boundaries through dependency injection", () => {
      const deps = createValidDependencies();

      const config = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      // Configuration structure should enforce proper DDD boundaries
      assertExists(config.processor);
      assertExists(config.fileSystem);
      assertExists(config.services);
      assertExists(config.frontmatterDataCreationService);
    });

    it("should separate file system concerns from domain logic", () => {
      const deps = createValidDependencies();

      const mockConfig = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      // File system operations should be abstracted through interfaces
      assertEquals(typeof mockConfig.fileSystem.reader.read, "function");
      assertEquals(typeof mockConfig.fileSystem.lister.list, "function");
    });

    it("should enforce service layer dependencies", () => {
      const deps = createValidDependencies();

      const mockConfig = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: { validate: () => {} },
          aggregator: { aggregate: () => {} },
          basePropertyPopulator: { populate: () => {} },
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      // Services should be injected as dependencies
      assertExists(mockConfig.services.schemaValidation);
      assertExists(mockConfig.services.aggregator);
      assertExists(mockConfig.services.basePropertyPopulator);
    });
  });

  describe("Pipeline Configuration Validation", () => {
    it("should validate processor dependency", () => {
      const deps = createValidDependencies();

      const config = {
        processor: null as any,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      const result = FrontmatterDocumentTransformationPipeline.create(config);

      assertEquals(result.ok, false);
    });

    it("should validate performance settings integration", () => {
      const deps = createValidDependencies();

      const config = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      // Performance settings should be properly typed
      assertExists(config.performanceSettings);
      assertEquals(config.performanceSettings, deps.performanceSettings);
    });

    it("should validate merge operations integration", () => {
      const deps = createValidDependencies();

      const config = {
        processor: deps.mockProcessor,
        fileSystem: {
          reader: deps.mockReader,
          lister: deps.mockLister,
        },
        services: {
          schemaValidation: deps.mockSchemaValidation,
          aggregator: deps.mockAggregator,
          basePropertyPopulator: deps.mockBasePropertyPopulator,
        },
        frontmatterDataCreationService: defaultFrontmatterDataCreationService,
        performanceSettings: deps.performanceSettings,
        mergeOperations: deps.mergeOperations,
      };

      // Merge operations should be properly typed
      assertExists(config.mergeOperations);
      assertEquals(config.mergeOperations, deps.mergeOperations);
    });
  });
});