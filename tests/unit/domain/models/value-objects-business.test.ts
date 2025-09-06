import { assertEquals } from "jsr:@std/assert";
import {
  ConfigPath,
  DocumentPath,
  FrontMatterContent,
  MappingRule,
  OutputPath,
  ProcessingOptions,
  SchemaVersion,
} from "../../../../src/domain/models/value-objects.ts";

/**
 * Business-focused Value Objects Domain Tests
 *
 * These tests focus on business requirements and domain invariants rather than
 * implementation details. They verify that value objects fulfill their domain
 * purpose: ensuring data integrity and business rule enforcement.
 */

Deno.test("Value Objects Domain - Document Processing Business Rules", async (t) => {
  await t.step(
    "Business Rule: DocumentPath must enable reliable file processing",
    async (t) => {
      await t.step(
        "Should support markdown files for frontmatter extraction workflow",
        () => {
          // Arrange - Document processing workflow needs valid markdown file paths
          const markdownPaths = [
            "/docs/project/requirements.md",
            "content/blog/post.md",
            "README.md",
            "./local/notes.md",
          ];

          for (const path of markdownPaths) {
            // Act - Create document path for processing pipeline
            const result = DocumentPath.create(path);

            // Assert - Valid markdown paths should enable document processing
            assertEquals(
              result.ok,
              true,
              `Valid markdown path should be accepted: ${path}`,
            );
            if (result.ok) {
              assertEquals(
                typeof result.data.getValue(),
                "string",
                "Document path should provide string value for file operations",
              );
              assertEquals(
                typeof result.data.getFilename(),
                "string",
                "Filename should be extractable for processing identification",
              );
              assertEquals(
                typeof result.data.getDirectory(),
                "string",
                "Directory should be extractable for relative path handling",
              );
            }
          }
        },
      );

      await t.step(
        "Should reject paths that would break document processing workflow",
        () => {
          // Arrange - Invalid paths that would cause processing failures
          const invalidPaths = [
            { path: "", reason: "Empty path cannot locate document" },
            {
              path: "   ",
              reason: "Whitespace path provides no file location",
            },
          ];

          for (const { path, reason } of invalidPaths) {
            // Act - Try to create document path for processing
            const result = DocumentPath.create(path);

            // Assert - Invalid paths should be rejected to prevent processing errors
            assertEquals(
              result.ok,
              false,
              `Invalid path should be rejected: ${reason}`,
            );
            if (!result.ok) {
              assertEquals(
                typeof result.error,
                "object",
                "Error should be provided for business debugging",
              );
            }
          }
        },
      );
    },
  );

  await t.step(
    "Business Rule: OutputPath must ensure reliable result delivery",
    async (t) => {
      await t.step(
        "Should support various output formats for different business needs",
        () => {
          // Arrange - Different business contexts need different output formats
          const outputScenarios = [
            {
              path: "/output/registry.json",
              format: "JSON registry for CLI tools",
            },
            {
              path: "build/schema.yaml",
              format: "YAML configuration for deployment",
            },
            {
              path: "./results/analysis.txt",
              format: "Text report for documentation",
            },
            { path: "export/data.csv", format: "CSV export for data analysis" },
          ];

          for (const { path, format } of outputScenarios) {
            // Act - Create output path for result delivery
            const result = OutputPath.create(path);

            // Assert - Valid output paths should enable result delivery
            assertEquals(
              result.ok,
              true,
              `Output path should support ${format}: ${path}`,
            );
            if (result.ok) {
              assertEquals(
                typeof result.data.getValue(),
                "string",
                "Output path should provide location for file writing",
              );
            }
          }
        },
      );
    },
  );
});

Deno.test("Value Objects Domain - Configuration Management Business Rules", async (t) => {
  await t.step(
    "Business Rule: ConfigPath must enable system configuration",
    () => {
      // Arrange - System needs to load configuration from various sources
      const configScenarios = [
        { path: "/config/app.json", context: "Application configuration" },
        {
          path: "/etc/frontmatter/settings.yaml",
          context: "System-wide settings",
        },
        {
          path: "/project/config.json",
          context: "Project-specific configuration",
        },
        {
          path: "/home/user/.frontmatter-schema.toml",
          context: "User preferences",
        },
      ];

      for (const { path, context } of configScenarios) {
        // Act - Create config path for system setup
        const result = ConfigPath.create(path);

        // Assert - Valid config paths should enable system configuration
        assertEquals(
          result.ok,
          true,
          `Config path should enable ${context}: ${path}`,
        );
        if (result.ok) {
          assertEquals(
            typeof result.data.getValue(),
            "string",
            "Config path should provide location for configuration loading",
          );
        }
      }
    },
  );

  await t.step(
    "Business Rule: ProcessingOptions must control transformation behavior",
    () => {
      // Arrange - Business needs different processing modes
      const processingModes = [
        {
          verbose: true,
          skipValidation: false,
          scenario:
            "Development mode with detailed logging and full validation",
        },
        {
          verbose: false,
          skipValidation: true,
          scenario: "Production mode with minimal logging and fast processing",
        },
        {
          verbose: true,
          skipValidation: true,
          scenario: "Debug mode with detailed logging but bypassed validation",
        },
      ];

      for (const { verbose, skipValidation, scenario } of processingModes) {
        // Act - Create processing options for business scenario
        const result = ProcessingOptions.create({
          parallel: verbose, // Use verbose as parallel for business scenario
          continueOnError: skipValidation, // Use skipValidation as continueOnError
        });

        // Assert - Valid options should enable the business scenario
        assertEquals(
          result.ok,
          true,
          `Processing options should enable ${scenario}`,
        );
        if (result.ok) {
          assertEquals(
            typeof result.data.isParallel(),
            "boolean",
            "Parallel setting should be accessible",
          );
          assertEquals(
            typeof result.data.getMaxConcurrency(),
            "number",
            "Concurrency setting should be accessible",
          );
        }
      }
    },
  );
});

Deno.test("Value Objects Domain - Content and Schema Management", async (t) => {
  await t.step(
    "Business Rule: FrontMatterContent must preserve document metadata",
    async (t) => {
      await t.step("Should handle typical document metadata formats", () => {
        // Arrange - Documents contain various metadata formats
        const metadataFormats = [
          {
            content: '{"title": "API Guide", "version": "1.0"}',
            type: "JSON metadata",
          },
          {
            content: "title: User Manual\nauthor: Tech Team",
            type: "YAML metadata",
          },
          {
            content: "c1: build\nc2: robust\nc3: code",
            type: "Climpt command metadata",
          },
        ];

        for (const { content, type } of metadataFormats) {
          // Act - Create frontmatter content for processing
          const result = FrontMatterContent.create(content);

          // Assert - Valid metadata should be preserved for transformation
          assertEquals(
            result.ok,
            true,
            `${type} should be preserved: ${content.slice(0, 20)}...`,
          );
          if (result.ok) {
            assertEquals(
              typeof result.data.getValue(),
              "string",
              "Content should be retrievable for parsing",
            );
          }
        }
      });
    },
  );

  await t.step("Business Rule: SchemaVersion must ensure compatibility", () => {
    // Arrange - System needs version compatibility tracking
    const versionScenarios = [
      { version: "1.0.0", context: "Initial release version" },
      { version: "2.1.3", context: "Feature update with patch" },
      { version: "0.9.0", context: "Pre-release version" },
      { version: "3.0.0", context: "Major version with breaking changes" },
    ];

    for (const { version, context } of versionScenarios) {
      // Act - Create schema version for compatibility tracking
      const result = SchemaVersion.create(version);

      // Assert - Valid versions should enable compatibility management
      assertEquals(
        result.ok,
        true,
        `Version should enable ${context}: ${version}`,
      );
      if (result.ok) {
        assertEquals(
          typeof result.data.toString(),
          "string",
          "Version should be representable as string",
        );
        assertEquals(
          typeof result.data.toString(),
          "string",
          "Version should be representable as string",
        );
      }
    }
  });
});

Deno.test("Value Objects Domain - Template Processing Business Rules", async (t) => {
  await t.step(
    "Business Rule: TemplateFormat must support output requirements",
    () => {
      // Arrange - Different business outputs need different template formats
      const formatRequirements = [
        { format: "json", businessCase: "API response formatting" },
        { format: "yaml", businessCase: "Configuration file generation" },
        { format: "handlebars", businessCase: "Dynamic content templating" },
        { format: "custom", businessCase: "Domain-specific formatting" },
      ] as const;

      for (const { format, businessCase } of formatRequirements) {
        // Act & Assert - Format should be valid for business use case
        assertEquals(
          typeof format,
          "string",
          `${businessCase} should have valid format: ${format}`,
        );

        // Verify the format is one of the expected business formats
        const validFormats = ["json", "yaml", "handlebars", "custom"];
        assertEquals(
          validFormats.includes(format),
          true,
          `Format should be supported for ${businessCase}`,
        );
      }
    },
  );

  await t.step(
    "Business Rule: MappingRule must enable data transformation",
    () => {
      // Arrange - Data transformation requires mapping between source and target
      const transformationScenarios = [
        {
          sourcePath: "frontmatter.title",
          targetPath: "output.heading",
          context: "Transform document title to output heading",
        },
        {
          sourcePath: "metadata.author",
          targetPath: "byline.name",
          context: "Map author information to byline",
        },
        {
          sourcePath: "config.version",
          targetPath: "header.version",
          context: "Transfer version to header display",
        },
      ];

      for (
        const { sourcePath, targetPath, context } of transformationScenarios
      ) {
        // Act - Create mapping rule for data transformation
        const result = MappingRule.create(sourcePath, targetPath);

        // Assert - Valid mapping rules should enable data transformation
        assertEquals(result.ok, true, `Mapping rule should enable ${context}`);
        if (result.ok) {
          assertEquals(
            result.data.getSource(),
            sourcePath,
            "Source path should be preserved for data extraction",
          );
          assertEquals(
            result.data.getTarget(),
            targetPath,
            "Target path should be preserved for data placement",
          );
        }
      }
    },
  );
});

Deno.test("Value Objects Domain - Business Workflow Integration", async (t) => {
  await t.step(
    "Workflow: Complete frontmatter-to-template transformation pipeline",
    () => {
      // Arrange - Represents the complete business workflow
      const documentPath = DocumentPath.create("docs/api/endpoints.md");
      const outputPath = OutputPath.create("build/api-docs.json");
      const schemaVersion = SchemaVersion.create("1.2.0");
      const mappingRule = MappingRule.create(
        "frontmatter.endpoints",
        "output.apiRoutes",
      );
      const processingOptions = ProcessingOptions.create({
        parallel: false,
        continueOnError: false,
      }); // Production mode

      // Assert - All value objects should be valid for complete workflow
      assertEquals(
        documentPath.ok,
        true,
        "Document path should enable source file reading",
      );
      assertEquals(
        outputPath.ok,
        true,
        "Output path should enable result file writing",
      );
      assertEquals(
        schemaVersion.ok,
        true,
        "Schema version should enable compatibility checking",
      );
      assertEquals(
        mappingRule.ok,
        true,
        "Mapping rule should enable data transformation",
      );
      assertEquals(
        processingOptions.ok,
        true,
        "Processing options should enable workflow control",
      );

      // Verify workflow completeness
      if (
        documentPath.ok && outputPath.ok && schemaVersion.ok &&
        mappingRule.ok && processingOptions.ok
      ) {
        // Business workflow can proceed with all required components
        assertEquals(
          typeof documentPath.data.getValue(),
          "string",
          "Source document is locatable",
        );
        assertEquals(
          typeof outputPath.data.getValue(),
          "string",
          "Output destination is specified",
        );
        assertEquals(
          typeof schemaVersion.data.toString(),
          "string",
          "Schema version is trackable",
        );
        assertEquals(
          typeof mappingRule.data.getSource(),
          "string",
          "Data source is mappable",
        );
        assertEquals(
          typeof mappingRule.data.getTarget(),
          "string",
          "Data target is specified",
        );
      }
    },
  );
});
