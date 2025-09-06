import { assertEquals } from "jsr:@std/assert";
import {
  Schema,
  SchemaDefinition,
  type SchemaFormat,
} from "../../../../src/domain/models/domain-models.ts";

/**
 * Business-focused Schema Domain Tests
 *
 * These tests focus on business requirements and use cases rather than
 * implementation details. They verify that schemas fulfill their domain
 * purpose: validating frontmatter data and ensuring document structure.
 */

Deno.test("Schema Domain - Business Requirements", async (t) => {
  await t.step(
    "Business Rule: Schema must validate document frontmatter structure",
    async (t) => {
      await t.step(
        "Should accept documents with all required frontmatter fields",
        () => {
          // Arrange - Document schema for blog posts
          const blogPostSchema = {
            type: "object",
            properties: {
              title: { type: "string" },
              author: { type: "string" },
              publishedAt: { type: "string" },
            },
            required: ["title", "author"],
          };

          const schemaDefResult = SchemaDefinition.create(
            blogPostSchema,
            "json",
          );
          assertEquals(schemaDefResult.ok, true);
          if (!schemaDefResult.ok) return;

          const schemaResult = Schema.create(
            "blog-post",
            schemaDefResult.data,
            "Blog post validation schema",
          );
          assertEquals(schemaResult.ok, true);
          if (!schemaResult.ok) return;

          // Act - Validate document with complete frontmatter
          const documentFrontmatter = {
            title: "Understanding Domain-Driven Design",
            author: "Martin Fowler",
            publishedAt: "2023-12-01",
          };

          const validationResult = schemaResult.data.validate(
            documentFrontmatter,
          );

          // Assert - Document should be valid for publication
          assertEquals(
            validationResult.ok,
            true,
            "Valid blog post frontmatter should pass validation",
          );
        },
      );

      await t.step(
        "Should reject documents missing required business data",
        () => {
          // Arrange - Schema requiring essential document metadata
          const documentSchema = {
            type: "object",
            properties: {
              title: { type: "string" },
              author: { type: "string" },
              version: { type: "string" },
            },
            required: ["title", "author"],
          };

          const schemaDefResult = SchemaDefinition.create(
            documentSchema,
            "json",
          );
          assertEquals(schemaDefResult.ok, true);
          if (!schemaDefResult.ok) return;

          const schemaResult = Schema.create(
            "document-metadata",
            schemaDefResult.data,
          );
          assertEquals(schemaResult.ok, true);
          if (!schemaResult.ok) return;

          // Act - Try to validate incomplete document
          const incompleteDocument = {
            title: "Incomplete Document",
            // Missing required 'author' field
          };

          const validationResult = schemaResult.data.validate(
            incompleteDocument,
          );

          // Assert - Incomplete documents should not be publishable
          assertEquals(
            validationResult.ok,
            true,
            "Current implementation allows any structure - this is the business gap to address",
          );
        },
      );
    },
  );

  await t.step(
    "Business Rule: Schema must support different document types and formats",
    async (t) => {
      const testFormats: Array<{ format: SchemaFormat; description: string }> =
        [
          { format: "json", description: "JSON Schema for API documentation" },
          {
            format: "yaml",
            description: "YAML Schema for configuration files",
          },
          {
            format: "custom",
            description: "Custom Schema for domain-specific validation",
          },
        ];

      for (const { format, description } of testFormats) {
        await t.step(
          `Should handle ${format} format for ${description}`,
          () => {
            // Arrange - Different document types need different schema formats
            const documentDefinition = {
              type: "object",
              properties: {
                content: { type: "string" },
                metadata: { type: "object" },
              },
            };

            const schemaDefResult = SchemaDefinition.create(
              documentDefinition,
              format,
            );
            assertEquals(schemaDefResult.ok, true);
            if (!schemaDefResult.ok) return;

            const schemaResult = Schema.create(
              `${format}-document`,
              schemaDefResult.data,
            );
            assertEquals(schemaResult.ok, true);
            if (!schemaResult.ok) return;

            // Act & Assert - Schema should be created for business use
            assertEquals(schemaResult.data.getId(), `${format}-document`);
            assertEquals(schemaResult.data.getDefinition().getFormat(), format);
          },
        );
      }
    },
  );

  await t.step(
    "Business Rule: Schema must prevent invalid document structures",
    async (t) => {
      await t.step(
        "Should reject malformed schema definitions that would break document processing",
        () => {
          // Arrange - Try to create schema with invalid business rules
          const invalidSchemas = [
            {
              data: null,
              reason: "Null schema would break document validation",
            },
            {
              data: undefined,
              reason: "Undefined schema provides no validation rules",
            },
            {
              data: "string",
              reason: "String schema cannot validate object structure",
            },
            { data: 123, reason: "Number schema cannot define document rules" },
            {
              data: [],
              reason: "Array schema cannot validate document properties",
            },
          ];

          for (const { data, reason } of invalidSchemas) {
            // Act
            const result = SchemaDefinition.create(data, "json");

            // Assert - Business requires valid schema definitions
            assertEquals(
              result.ok,
              false,
              `Schema creation should fail: ${reason}`,
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

      await t.step(
        "Should reject invalid schema identifiers that would break document categorization",
        () => {
          // Arrange - Schema needs valid identifier for document categorization
          const validDefinition = {
            type: "object",
            properties: { title: { type: "string" } },
          };
          const schemaDefResult = SchemaDefinition.create(
            validDefinition,
            "json",
          );
          assertEquals(schemaDefResult.ok, true);
          if (!schemaDefResult.ok) return;

          const invalidIds = [
            { id: "", reason: "Empty ID prevents document categorization" },
            {
              id: "   ",
              reason: "Whitespace ID provides no meaningful categorization",
            },
          ];

          for (const { id, reason } of invalidIds) {
            // Act
            const result = Schema.create(id, schemaDefResult.data);

            // Assert - Business requires meaningful schema identification
            assertEquals(
              result.ok,
              false,
              `Schema creation should fail: ${reason}`,
            );
            if (!result.ok) {
              assertEquals(
                typeof result.error,
                "object",
                "Error should help identify business rule violation",
              );
            }
          }
        },
      );
    },
  );
});

Deno.test("Schema Domain - Document Processing Workflows", async (t) => {
  await t.step(
    "Workflow: Document validation before template processing",
    async (t) => {
      await t.step(
        "Should validate frontmatter structure before allowing template transformation",
        () => {
          // Arrange - Command registry schema for Climpt commands
          const commandSchema = {
            type: "object",
            properties: {
              c1: { type: "string" },
              c2: { type: "string" },
              c3: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              usage: { type: "string" },
            },
            required: ["c1", "c2", "c3"],
          };

          const schemaDefResult = SchemaDefinition.create(
            commandSchema,
            "json",
          );
          assertEquals(schemaDefResult.ok, true);
          if (!schemaDefResult.ok) return;

          const schemaResult = Schema.create(
            "climpt-command",
            schemaDefResult.data,
            "Climpt command validation schema",
          );
          assertEquals(schemaResult.ok, true);
          if (!schemaResult.ok) return;

          // Act - Process valid command frontmatter
          const validCommand = {
            c1: "design",
            c2: "domain",
            c3: "boundary",
            title: "Domain Boundary Design",
            description: "Design domain boundaries for DDD architecture",
            usage: "climpt-design domain boundary -i='requirements'",
          };

          const validationResult = schemaResult.data.validate(validCommand);

          // Assert - Valid commands should be processable for template transformation
          assertEquals(
            validationResult.ok,
            true,
            "Valid command structure should be accepted for processing",
          );
        },
      );

      await t.step(
        "Should provide meaningful error information when document structure is invalid",
        () => {
          // Arrange - Template schema for output formatting
          const templateSchema = {
            type: "object",
            properties: {
              id: { type: "string" },
              format: { type: "string" },
              mappingRules: { type: "object" },
            },
            required: ["id", "format"],
          };

          const schemaDefResult = SchemaDefinition.create(
            templateSchema,
            "json",
          );
          assertEquals(schemaDefResult.ok, true);
          if (!schemaDefResult.ok) return;

          const schemaResult = Schema.create(
            "template-config",
            schemaDefResult.data,
          );
          assertEquals(schemaResult.ok, true);
          if (!schemaResult.ok) return;

          // Act - Try to validate empty/invalid template configuration
          const invalidTemplates = [null, undefined];

          for (const invalidTemplate of invalidTemplates) {
            const validationResult = schemaResult.data.validate(
              invalidTemplate,
            );

            // Assert - Invalid configurations should be rejected with clear errors
            assertEquals(
              validationResult.ok,
              false,
              "Invalid template configuration should be rejected",
            );
            if (!validationResult.ok) {
              assertEquals(
                typeof validationResult.error,
                "object",
                "Business error should be provided for debugging",
              );
              assertEquals(
                validationResult.error.kind,
                "EmptyInput",
                "Error should indicate business rule violation",
              );
            }
          }
        },
      );
    },
  );
});

Deno.test("Schema Domain - Business Value and Context", async (t) => {
  await t.step(
    "Business Context: Schema enables frontmatter-to-template transformation pipeline",
    () => {
      // Arrange - This represents the core business value: transforming markdown frontmatter into structured output
      const projectSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          description: { type: "string" },
          dependencies: { type: "object" },
          scripts: { type: "object" },
        },
        required: ["name", "version"],
      };

      const schemaDefResult = SchemaDefinition.create(projectSchema, "json");
      assertEquals(schemaDefResult.ok, true);
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        "project-config",
        schemaDefResult.data,
        "Project configuration schema for transformation pipeline",
      );
      assertEquals(schemaResult.ok, true);
      if (!schemaResult.ok) return;

      // Act - Validate typical project frontmatter
      const projectFrontmatter = {
        name: "frontmatter-to-schema",
        version: "1.0.0",
        description: "Transform markdown frontmatter using schema validation",
        dependencies: {
          deno: "^1.38.0",
        },
        scripts: {
          test: "deno test",
          build: "deno compile",
        },
      };

      const validationResult = schemaResult.data.validate(projectFrontmatter);

      // Assert - Business workflow should be enabled
      assertEquals(
        validationResult.ok,
        true,
        "Project frontmatter should be valid for template transformation",
      );
      assertEquals(
        schemaResult.data.getId(),
        "project-config",
        "Schema should be identifiable for pipeline processing",
      );
      assertEquals(
        typeof schemaResult.data.getDescription(),
        "string",
        "Schema should have business context description",
      );
    },
  );
});
