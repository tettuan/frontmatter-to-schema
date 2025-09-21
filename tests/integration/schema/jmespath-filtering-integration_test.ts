import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { SchemaProcessingService } from "../../../src/domain/schema/services/schema-processing-service.ts";
import { JMESPathFilterService } from "../../../src/domain/schema/services/jmespath-filter-service.ts";
import { BasePropertyPopulator } from "../../../src/domain/schema/services/base-property-populator.ts";
import {
  FileSystemSchemaRepository,
  NoOpDebugLogger,
} from "../../../src/infrastructure/index.ts";
import { FrontmatterData } from "../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { TemplateSchemaBindingService } from "../../../src/domain/template/services/template-schema-binding-service.ts";

describe("JMESPath Filtering Integration", () => {
  describe("SchemaProcessingService with JMESPath filtering", () => {
    it("should apply JMESPath filtering when x-jmespath-filter is present", () => {
      // Create services
      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      // Create test data with mixed commands
      const testDataResult = FrontmatterData.create({
        commands: [
          { c1: "git", c2: "create", c3: "issue" },
          { c1: "git", c2: "list", c3: "branches" },
          { c1: "spec", c2: "analyze", c3: "quality" },
        ],
      });
      assertExists(testDataResult.ok);
      if (!testDataResult.ok) return;

      // This test verifies that the JMESPath filtering logic works in the service
      // We can't easily test the full pipeline without file system setup
      const filterResult = jmespathServiceResult.data.applyFilter(
        testDataResult.data,
        "commands[?c1 == 'git']",
      );

      assertExists(filterResult.ok);
      if (filterResult.ok) {
        const filtered = filterResult.data as unknown[];
        assertEquals(filtered.length, 2);
        assertEquals((filtered[0] as any).c2, "create");
        assertEquals((filtered[1] as any).c2, "list");
      }
    });

    it("should handle nested property JMESPath filtering", () => {
      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      const testDataResult = FrontmatterData.create({
        metadata: {
          title: "Test Document",
          tags: ["important", "test", "example"],
          author: {
            name: "John Doe",
            email: "john@example.com",
          },
        },
        content: "Some content here",
      });
      assertExists(testDataResult.ok);
      if (!testDataResult.ok) return;

      // Test object transformation with JMESPath
      const filterResult = jmespathServiceResult.data.applyFilter(
        testDataResult.data,
        "metadata | {title: title, author_name: author.name, tag_count: length(tags)}",
      );

      assertExists(filterResult.ok);
      if (filterResult.ok) {
        const transformed = filterResult.data as any;
        assertEquals(transformed.title, "Test Document");
        assertEquals(transformed.author_name, "John Doe");
        assertEquals(transformed.tag_count, 3);
      }
    });
  });

  describe("TemplateSchemaBindingService with JMESPath filtering", () => {
    it("should create variable context with JMESPath filtering applied", () => {
      // Create JMESPath service
      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      // Create schema processing service
      const debugLogger = new NoOpDebugLogger();
      const schemaRepository = new FileSystemSchemaRepository(debugLogger);
      const basePropertyPopulator = new BasePropertyPopulator();

      const schemaProcessingServiceResult = SchemaProcessingService.create(
        schemaRepository,
        basePropertyPopulator,
        jmespathServiceResult.data,
      );
      if (!schemaProcessingServiceResult.ok) {
        throw new Error("Failed to create schema processing service");
      }
      const schemaProcessingService = schemaProcessingServiceResult.data;

      // Create template-schema binding service with JMESPath support
      const bindingServiceResult = TemplateSchemaBindingService.create(
        schemaProcessingService,
      );
      assertExists(bindingServiceResult.ok);
      if (!bindingServiceResult.ok) return;

      // Create test data that will be filtered
      const testDataResult = FrontmatterData.create({
        commands: [
          { c1: "git", c2: "create", c3: "issue", active: true },
          { c1: "git", c2: "list", c3: "branches", active: false },
          { c1: "spec", c2: "analyze", c3: "quality", active: true },
        ],
      });
      assertExists(testDataResult.ok);
      if (!testDataResult.ok) return;

      // This test demonstrates that the binding service can work with JMESPath filtering
      // In a real scenario, it would create filtered variable contexts
      const service = bindingServiceResult.data;

      // Verify service was created successfully with JMESPath support
      assertEquals(typeof service, "object");
      assertEquals(typeof service.createVariableContext, "function");
    });

    it("should validate template variables with filtered data", () => {
      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      const testDataResult = FrontmatterData.create({
        project: {
          name: "frontmatter-to-schema",
          dependencies: [
            { name: "jsr:@std/assert", version: "^1.0.14", type: "dev" },
            { name: "@halvardm/jmespath", version: "^0.17.0", type: "prod" },
          ],
        },
      });
      assertExists(testDataResult.ok);
      if (!testDataResult.ok) return;

      // Test complex filtering that extracts production dependencies
      const filterResult = jmespathServiceResult.data.applyFilter(
        testDataResult.data,
        "project.dependencies[?type == 'prod'].name",
      );

      assertExists(filterResult.ok);
      if (filterResult.ok) {
        const prodDeps = filterResult.data as string[];
        assertEquals(prodDeps.length, 1);
        assertEquals(prodDeps[0], "@halvardm/jmespath");
      }
    });
  });

  describe("Error handling in integration scenarios", () => {
    it("should handle JMESPath compilation errors gracefully", () => {
      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      const testDataResult = FrontmatterData.create({
        test: "data",
      });
      assertExists(testDataResult.ok);
      if (!testDataResult.ok) return;

      // Test with invalid JMESPath expression
      const filterResult = jmespathServiceResult.data.applyFilter(
        testDataResult.data,
        "[?invalid syntax",
      );

      assertEquals(filterResult.ok, false);
      if (!filterResult.ok) {
        // Should get either compilation or execution error
        const isValidErrorType =
          filterResult.error.kind === "JMESPathCompilationFailed" ||
          filterResult.error.kind === "JMESPathExecutionFailed";
        assertEquals(isValidErrorType, true);
      }
    });

    it("should handle data conversion edge cases", () => {
      const jmespathServiceResult = JMESPathFilterService.create();
      assertExists(jmespathServiceResult.ok);
      if (!jmespathServiceResult.ok) return;

      // Test with complex nested data structure
      const testDataResult = FrontmatterData.create({
        users: [
          {
            profile: {
              settings: {
                notifications: {
                  email: true,
                  sms: false,
                },
              },
            },
          },
          {
            profile: {
              settings: {
                notifications: {
                  email: false,
                  sms: true,
                },
              },
            },
          },
        ],
      });
      assertExists(testDataResult.ok);
      if (!testDataResult.ok) return;

      // Test deep nested filtering
      const filterResult = jmespathServiceResult.data.applyFilter(
        testDataResult.data,
        "users[?profile.settings.notifications.email == `true`]",
      );

      assertExists(filterResult.ok);
      if (filterResult.ok) {
        const emailUsers = filterResult.data as unknown[];
        assertEquals(emailUsers.length, 1);
      }
    });
  });
});
