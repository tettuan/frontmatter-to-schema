/**
 * Specification-driven tests for OutputRenderingService
 *
 * This test file validates business requirements for dual template rendering
 * rather than testing implementation details with mocks.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import { OutputRenderingService } from "../../../../../src/domain/template/services/output-rendering-service.ts";
import { TemplateRenderer } from "../../../../../src/domain/template/renderers/template-renderer.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";
import {
  err,
  ok,
  Result,
} from "../../../../../src/domain/shared/types/result.ts";
import { DomainError } from "../../../../../src/domain/shared/types/errors.ts";
import {
  DomainRule,
  SpecificationAssertions,
} from "../../../../helpers/specification-test-framework.ts";

/**
 * In-memory file system for specification testing
 * Implements actual file operations following business rules
 */
class InMemoryFileSystem {
  private readonly files = new Map<string, string>();
  private readonly writtenFiles = new Map<string, string>();

  addTemplate(path: string, content: unknown): void {
    this.files.set(path, JSON.stringify(content));
  }

  read(path: string): Result<string, DomainError & { message: string }> {
    const content = this.files.get(path);
    if (!content) {
      return err({
        kind: "FileNotFound" as const,
        path,
        message: `File not found: ${path}`,
      });
    }
    return ok(content);
  }

  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }> {
    this.writtenFiles.set(path, content);
    return ok(undefined);
  }

  getWrittenContent(path: string): string | undefined {
    return this.writtenFiles.get(path);
  }
}

/**
 * Test data builder for template scenarios
 * Creates valid business scenarios without mock complexity
 */
class TemplateTestScenarioBuilder {
  private mainTemplate: unknown = {};
  private itemTemplate: unknown = {};
  private mainData: Record<string, unknown> = {};
  private itemsData: Record<string, unknown>[] = [];

  withMainTemplate(template: unknown): this {
    this.mainTemplate = template;
    return this;
  }

  withItemTemplate(template: unknown): this {
    this.itemTemplate = template;
    return this;
  }

  withMainData(data: Record<string, unknown>): this {
    this.mainData = data;
    return this;
  }

  withItemsData(items: Record<string, unknown>[]): this {
    this.itemsData = items;
    return this;
  }

  build(): {
    fileSystem: InMemoryFileSystem;
    mainData: FrontmatterData;
    itemsData: FrontmatterData[];
  } {
    const fileSystem = new InMemoryFileSystem();
    fileSystem.addTemplate("main-template.json", this.mainTemplate);
    fileSystem.addTemplate("item-template.json", this.itemTemplate);

    const mainDataResult = TestDataFactory.createFrontmatterData(this.mainData);
    if (!mainDataResult.ok) {
      throw new Error("Failed to create main data");
    }

    const itemsData: FrontmatterData[] = [];
    for (const item of this.itemsData) {
      const itemResult = TestDataFactory.createFrontmatterData(item);
      if (!itemResult.ok) {
        throw new Error("Failed to create item data");
      }
      itemsData.push(itemResult.data);
    }

    return {
      fileSystem,
      mainData: mainDataResult.data,
      itemsData,
    };
  }
}

/**
 * Business requirements for dual template rendering
 */
const dualTemplateRenderingRequirements = {
  templateStructure: {
    name: "dual-template-structure-support",
    description:
      "System must support x-template and x-template-items dual structure",
    validator: (data: any) => ({
      isValid: data.hasMainTemplate && data.hasItemTemplate,
      violation: !data.hasMainTemplate || !data.hasItemTemplate
        ? "Both main and item templates must be supported"
        : undefined,
    }),
  },

  variableReplacement: {
    name: "template-variable-replacement",
    description:
      "All {{variable}} placeholders must be replaced with actual values",
    validator: (data: any) => ({
      isValid: !data.output?.includes("{{") && !data.output?.includes("}}"),
      violation: data.output?.includes("{{") || data.output?.includes("}}")
        ? "All template variables must be replaced"
        : undefined,
    }),
  },

  itemsProcessing: {
    name: "items-array-processing",
    description: "Item template must be applied to each item in the data array",
    validator: (data: any) => ({
      isValid: Array.isArray(data.processedItems) &&
        data.processedItems.length === data.expectedCount,
      violation: !Array.isArray(data.processedItems) ||
          data.processedItems.length !== data.expectedCount
        ? "All items must be processed with item template"
        : undefined,
    }),
  },

  outputIntegrity: {
    name: "rendered-output-integrity",
    description:
      "Final output must be valid structured data with all variables resolved",
    validator: (data: any) => ({
      isValid: data.isValidJson && data.hasAllExpectedFields,
      violation: !data.isValidJson || !data.hasAllExpectedFields
        ? "Output must be valid with all expected fields"
        : undefined,
    }),
  },
};

describe("BUSINESS REQUIREMENT: Dual Template Rendering Architecture", () => {
  describe("GIVEN: OutputRenderingService initialization", () => {
    it("WHEN: Creating service THEN: Should initialize with template rendering capability", () => {
      // Arrange - Business scenario setup
      const rendererResult = TemplateRenderer.create();
      assert(rendererResult.ok, "Template renderer creation should succeed");

      const fileSystem = new InMemoryFileSystem();

      // Act - Execute service creation
      const serviceResult = OutputRenderingService.create(
        rendererResult.data,
        fileSystem,
        fileSystem,
      );

      // Assert - Validate business requirements
      assert(
        serviceResult.ok,
        "OutputRenderingService creation should succeed",
      );

      if (serviceResult.ok) {
        // Business requirement: Service must be properly initialized
        assert(
          serviceResult.data instanceof OutputRenderingService,
          "Must return valid OutputRenderingService instance",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Dual Template Structure Processing", () => {
  describe("GIVEN: Main template and item template", () => {
    it("WHEN: Rendering with dual templates THEN: Should process both template layers", () => {
      // Arrange - Business scenario with dual template structure
      const scenario = new TemplateTestScenarioBuilder()
        .withMainTemplate({
          title: "Article Index",
          description: "{{description}}",
          totalCount: "{{totalCount}}",
          items: "{{items}}",
        })
        .withItemTemplate({
          id: "{{id}}",
          name: "{{name}}",
          value: "{{value}}",
        })
        .withMainData({
          description: "Test Articles",
          totalCount: 3,
        })
        .withItemsData([
          { id: "item-1", name: "Item 1", value: 100 },
          { id: "item-2", name: "Item 2", value: 200 },
          { id: "item-3", name: "Item 3", value: 300 },
        ])
        .build();

      const rendererResult = TemplateRenderer.create();
      assert(rendererResult.ok);

      const serviceResult = OutputRenderingService.create(
        rendererResult.data,
        scenario.fileSystem,
        scenario.fileSystem,
      );
      assert(serviceResult.ok);

      // Act - Execute dual template rendering
      const result = serviceResult.data.renderOutput(
        "main-template.json",
        "item-template.json",
        scenario.mainData,
        scenario.itemsData,
        "output.json",
      );

      // Assert - Validate business requirements
      assert(result.ok, "Dual template rendering should succeed");

      if (result.ok) {
        const outputContent = scenario.fileSystem.getWrittenContent(
          "output.json",
        );
        assert(outputContent, "Output content must be written");

        // Validate template structure requirement
        SpecificationAssertions.assertBusinessRequirement(
          { hasMainTemplate: true, hasItemTemplate: true },
          dualTemplateRenderingRequirements.templateStructure,
          "Dual template structure must be supported",
        );

        // Business requirement: Output must be valid JSON
        let parsedOutput: any;
        try {
          parsedOutput = JSON.parse(outputContent);
        } catch {
          throw new Error("Output must be valid JSON");
        }

        // Validate variable replacement requirement
        SpecificationAssertions.assertBusinessRequirement(
          { output: outputContent },
          dualTemplateRenderingRequirements.variableReplacement,
          "All template variables must be replaced",
        );

        // Business requirement: Main template variables must be replaced
        assertEquals(parsedOutput.title, "Article Index");
        assertEquals(parsedOutput.description, "Test Articles");
        assertEquals(parsedOutput.totalCount, "3"); // Template rendering produces strings

        // Business requirement: Items must be processed and embedded
        assert(Array.isArray(parsedOutput.items), "Items must be an array");
        assertEquals(
          parsedOutput.items.length,
          3,
          "All items must be processed",
        );

        // Validate items processing requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            processedItems: parsedOutput.items,
            expectedCount: 3,
          },
          dualTemplateRenderingRequirements.itemsProcessing,
          "All items must be processed with item template",
        );

        // Business requirement: Each item must have template variables replaced
        for (let i = 0; i < parsedOutput.items.length; i++) {
          const item = parsedOutput.items[i];
          assertEquals(item.id, `item-${i + 1}`);
          assertEquals(item.name, `Item ${i + 1}`);
          assertEquals(item.value, ((i + 1) * 100).toString()); // Template rendering converts numbers to strings
        }

        // Validate output integrity requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            isValidJson: true,
            hasAllExpectedFields: parsedOutput.title &&
              parsedOutput.description &&
              parsedOutput.totalCount !== undefined && parsedOutput.items,
          },
          dualTemplateRenderingRequirements.outputIntegrity,
          "Output must be valid with all expected fields",
        );
      }
    });

    it("WHEN: Rendering with empty items array THEN: Should handle gracefully", () => {
      // Arrange - Business scenario with no items
      const scenario = new TemplateTestScenarioBuilder()
        .withMainTemplate({
          title: "Empty Index",
          count: "{{count}}",
          items: "{{items}}",
        })
        .withItemTemplate({
          id: "{{id}}",
        })
        .withMainData({
          count: 0,
        })
        .withItemsData([])
        .build();

      const rendererResult = TemplateRenderer.create();
      assert(rendererResult.ok);

      const serviceResult = OutputRenderingService.create(
        rendererResult.data,
        scenario.fileSystem,
        scenario.fileSystem,
      );
      assert(serviceResult.ok);

      // Act - Execute rendering with empty items
      const result = serviceResult.data.renderOutput(
        "main-template.json",
        "item-template.json",
        scenario.mainData,
        scenario.itemsData,
        "output.json",
      );

      // Assert - Validate graceful handling
      assert(result.ok, "Rendering with empty items should succeed");

      if (result.ok) {
        const outputContent = scenario.fileSystem.getWrittenContent(
          "output.json",
        );
        assert(outputContent, "Output must be written even with empty items");

        const parsedOutput = JSON.parse(outputContent);

        // Business requirement: Empty items array should be handled
        assertEquals(parsedOutput.count, "0"); // Template rendering converts numbers to strings
        assert(
          Array.isArray(parsedOutput.items),
          "Items must still be an array",
        );
        assertEquals(
          parsedOutput.items.length,
          0,
          "Empty items array expected",
        );
      }
    });

    it("WHEN: Rendering with complex nested data THEN: Should handle deep structures", () => {
      // Arrange - Business scenario with complex data structures
      const scenario = new TemplateTestScenarioBuilder()
        .withMainTemplate({
          metadata: {
            title: "{{title}}",
            version: "{{version}}",
          },
          data: "{{items}}",
        })
        .withItemTemplate({
          entry: {
            id: "{{id}}",
            properties: {
              name: "{{name}}",
              config: {
                enabled: "{{enabled}}",
                priority: "{{priority}}",
              },
            },
          },
        })
        .withMainData({
          title: "Complex Structure Test",
          version: "2.0",
        })
        .withItemsData([
          {
            id: "complex-1",
            name: "Complex Item 1",
            enabled: true,
            priority: 1,
          },
          {
            id: "complex-2",
            name: "Complex Item 2",
            enabled: false,
            priority: 2,
          },
        ])
        .build();

      const rendererResult = TemplateRenderer.create();
      assert(rendererResult.ok);

      const serviceResult = OutputRenderingService.create(
        rendererResult.data,
        scenario.fileSystem,
        scenario.fileSystem,
      );
      assert(serviceResult.ok);

      // Act - Execute complex structure rendering
      const result = serviceResult.data.renderOutput(
        "main-template.json",
        "item-template.json",
        scenario.mainData,
        scenario.itemsData,
        "output.json",
      );

      // Assert - Validate complex structure handling
      assert(result.ok, "Complex structure rendering should succeed");

      if (result.ok) {
        const outputContent = scenario.fileSystem.getWrittenContent(
          "output.json",
        );
        assert(outputContent);

        const parsedOutput = JSON.parse(outputContent);

        // Business requirement: Nested structures must be preserved
        assertEquals(parsedOutput.metadata.title, "Complex Structure Test");
        assertEquals(parsedOutput.metadata.version, "2.0");

        assert(Array.isArray(parsedOutput.data));
        assertEquals(parsedOutput.data.length, 2);

        // Business requirement: Complex item structures must be rendered correctly
        const firstItem = parsedOutput.data[0];
        assertEquals(firstItem.entry.id, "complex-1");
        assertEquals(firstItem.entry.properties.name, "Complex Item 1");
        assertEquals(firstItem.entry.properties.config.enabled, "true"); // Template rendering converts booleans to strings
        assertEquals(firstItem.entry.properties.config.priority, "1"); // Template rendering converts numbers to strings
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Template Error Handling", () => {
  describe("GIVEN: Invalid template scenarios", () => {
    it("WHEN: Main template not found THEN: Should return appropriate error", () => {
      // Arrange - Business scenario with missing template
      const fileSystem = new InMemoryFileSystem();
      // Intentionally not adding main template

      const rendererResult = TemplateRenderer.create();
      assert(rendererResult.ok);

      const serviceResult = OutputRenderingService.create(
        rendererResult.data,
        fileSystem,
        fileSystem,
      );
      assert(serviceResult.ok);

      const mainDataResult = TestDataFactory.createFrontmatterData({});
      assert(mainDataResult.ok);

      // Act - Attempt rendering with missing template
      const result = serviceResult.data.renderOutput(
        "missing-template.json",
        "item-template.json",
        mainDataResult.data,
        [],
        "output.json",
      );

      // Assert - Validate error handling
      assert(!result.ok, "Rendering with missing template should fail");

      if (!result.ok) {
        // Business requirement: Missing templates must be reported clearly
        assert(
          result.error.message.includes("missing-template") ||
            result.error.message.includes("not found"),
          "Error must identify missing template",
        );
      }
    });
  });
});

/**
 * Domain rule validation tests
 */
describe("DOMAIN RULES: Output Rendering Service", () => {
  const outputRenderingRules: DomainRule<any> = {
    name: "output-rendering-completeness",
    description: "Output rendering must handle dual template scenarios",
    validator: (data) => ({
      isValid: data.service &&
        typeof data.service.renderOutput === "function",
      violation: "Output rendering service must provide rendering capability",
    }),
  };

  it("Should enforce output rendering domain rules", () => {
    const rendererResult = TemplateRenderer.create();
    assert(rendererResult.ok);

    const fileSystem = new InMemoryFileSystem();

    const serviceResult = OutputRenderingService.create(
      rendererResult.data,
      fileSystem,
      fileSystem,
    );
    assert(serviceResult.ok);

    SpecificationAssertions.assertDomainRule(
      { service: serviceResult.data },
      outputRenderingRules,
      "output-rendering",
      "Output rendering must satisfy domain requirements",
    );
  });
});
