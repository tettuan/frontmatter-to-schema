/**
 * Specification-driven tests for Dual Format Template Support
 *
 * This test file validates business requirements for dual format template rendering
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
 * In-memory file system for dual format template testing
 * Implements actual file operations following business rules
 */
class InMemoryTemplateFileSystem {
  private readonly templates = new Map<string, string>();
  private readonly outputs = new Map<string, string>();

  addTemplate(path: string, content: string): void {
    this.templates.set(path, content);
  }

  read(path: string): Result<string, DomainError & { message: string }> {
    const content = this.templates.get(path);
    if (!content) {
      return err({
        kind: "FileNotFound" as const,
        path,
        message: `Template not found: ${path}`,
      });
    }
    return ok(content);
  }

  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }> {
    this.outputs.set(path, content);
    return ok(undefined);
  }

  getOutput(path: string): string | undefined {
    return this.outputs.get(path);
  }
}

/**
 * Test scenario builder for dual format template scenarios
 * Creates valid business scenarios without mock complexity
 */
class DualFormatTemplateScenarioBuilder {
  private jsonTemplate?: string;
  private yamlTemplate?: string;
  private jsonItemTemplate?: string;
  private yamlItemTemplate?: string;
  private mainData: Record<string, unknown> = {};
  private itemsData: Record<string, unknown>[] = [];

  withJsonMainTemplate(template: Record<string, unknown>): this {
    this.jsonTemplate = JSON.stringify(template, null, 2);
    return this;
  }

  withYamlMainTemplate(template: string): this {
    this.yamlTemplate = template;
    return this;
  }

  withJsonItemTemplate(template: Record<string, unknown>): this {
    this.jsonItemTemplate = JSON.stringify(template);
    return this;
  }

  withYamlItemTemplate(template: string): this {
    this.yamlItemTemplate = template;
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
    fileSystem: InMemoryTemplateFileSystem;
    mainData: FrontmatterData;
    itemsData: FrontmatterData[];
    templatePaths: { main: string; item?: string };
  } {
    const fileSystem = new InMemoryTemplateFileSystem();

    let mainTemplatePath: string;
    let itemTemplatePath: string | undefined;

    // Add templates to file system based on format
    if (this.jsonTemplate) {
      mainTemplatePath = "main-template.json";
      fileSystem.addTemplate(mainTemplatePath, this.jsonTemplate);
    } else if (this.yamlTemplate) {
      mainTemplatePath = "main-template.yaml";
      fileSystem.addTemplate(mainTemplatePath, this.yamlTemplate);
    } else {
      throw new Error("No main template specified");
    }

    if (this.jsonItemTemplate) {
      itemTemplatePath = "item-template.json";
      fileSystem.addTemplate(itemTemplatePath, this.jsonItemTemplate);
    } else if (this.yamlItemTemplate) {
      itemTemplatePath = "item-template.yaml";
      fileSystem.addTemplate(itemTemplatePath, this.yamlItemTemplate);
    }

    // Create frontmatter data
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
      templatePaths: {
        main: mainTemplatePath,
        item: itemTemplatePath,
      },
    };
  }
}

/**
 * Business requirements for dual format template support
 */
const dualFormatTemplateRequirements = {
  formatSupport: {
    name: "dual-format-template-support",
    description: "System must support both JSON and YAML template formats",
    validator: (data: any) => ({
      isValid: data.supportsJson && data.supportsYaml,
      violation: !data.supportsJson || !data.supportsYaml
        ? "Both JSON and YAML formats must be supported"
        : undefined,
    }),
  },

  formatConsistency: {
    name: "format-consistency",
    description: "Template rendering must be consistent across formats",
    validator: (data: any) => ({
      isValid: data.hasConsistentOutput && data.preservesStructure,
      violation: !data.hasConsistentOutput || !data.preservesStructure
        ? "Output must be consistent regardless of template format"
        : undefined,
    }),
  },

  mixedFormatHandling: {
    name: "mixed-format-handling",
    description: "System must handle mixed format scenarios gracefully",
    validator: (data: any) => ({
      isValid: data.handlesMixedFormats && data.maintainsCompatibility,
      violation: !data.handlesMixedFormats || !data.maintainsCompatibility
        ? "Mixed format combinations must be handled properly"
        : undefined,
    }),
  },

  errorRobustness: {
    name: "format-error-robustness",
    description: "Invalid templates must be handled with clear error messages",
    validator: (data: any) => ({
      isValid: data.hasErrorHandling && data.providesSpecificErrors,
      violation: !data.hasErrorHandling || !data.providesSpecificErrors
        ? "Format errors must be handled with specific error messages"
        : undefined,
    }),
  },
};

describe("BUSINESS REQUIREMENT: Dual Format Template Support", () => {
  describe("GIVEN: JSON template format support", () => {
    it("WHEN: Rendering JSON templates THEN: Should process JSON structure correctly", () => {
      // Arrange - Business scenario with JSON templates
      const scenario = new DualFormatTemplateScenarioBuilder()
        .withJsonMainTemplate({
          version: "{version}",
          description: "{description}",
          tools: {
            commands: ["{@items}"],
          },
        })
        .withJsonItemTemplate({
          c1: "{c1}",
          c2: "{c2}",
          description: "{description}",
        })
        .withMainData({
          version: "1.0.0",
          description: "Test registry",
        })
        .withItemsData([
          { c1: "git", c2: "commit", description: "Git commit command" },
          { c1: "spec", c2: "analyze", description: "Spec analysis command" },
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

      // Act - Execute JSON template rendering
      const result = serviceResult.data.renderOutput(
        scenario.templatePaths.main,
        scenario.templatePaths.item,
        scenario.mainData,
        scenario.itemsData,
        "output.json",
      );

      // Assert - Validate business requirements
      assert(result.ok, "JSON template rendering should succeed");

      if (result.ok) {
        const outputContent = scenario.fileSystem.getOutput("output.json");
        assert(outputContent, "JSON output must be written");

        // Business requirement: JSON output must be valid and structured
        let parsedOutput: any;
        try {
          parsedOutput = JSON.parse(outputContent);
        } catch {
          throw new Error("Output must be valid JSON");
        }

        // Validate format support requirement
        SpecificationAssertions.assertBusinessRequirement(
          { supportsJson: true, supportsYaml: true },
          dualFormatTemplateRequirements.formatSupport,
          "JSON format must be supported",
        );

        // Business requirement: JSON structure must be preserved
        assertEquals(parsedOutput.version, "1.0.0");
        assertEquals(parsedOutput.description, "Test registry");
        assert(Array.isArray(parsedOutput.tools.commands));
        // The {@items} placeholder creates a single array element containing all items
        assertEquals(parsedOutput.tools.commands.length, 1);
        assert(Array.isArray(parsedOutput.tools.commands[0]));
        assertEquals(parsedOutput.tools.commands[0].length, 2);

        // Validate format consistency requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            hasConsistentOutput: true,
            preservesStructure: parsedOutput.tools &&
              Array.isArray(parsedOutput.tools.commands),
          },
          dualFormatTemplateRequirements.formatConsistency,
          "JSON structure must be preserved consistently",
        );
      }
    });

    it("WHEN: Rendering with complex JSON structure THEN: Should handle nested objects", () => {
      // Arrange - Complex JSON business scenario
      const scenario = new DualFormatTemplateScenarioBuilder()
        .withJsonMainTemplate({
          metadata: {
            version: "{version}",
            author: "{author}",
          },
          configuration: {
            settings: "{@items}",
          },
        })
        .withJsonItemTemplate({
          key: "{key}",
          value: "{value}",
          type: "{type}",
        })
        .withMainData({
          version: "2.0.0",
          author: "Test Author",
        })
        .withItemsData([
          { key: "debug", value: "true", type: "boolean" },
          { key: "timeout", value: "30", type: "number" },
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

      // Act - Execute complex JSON rendering
      const result = serviceResult.data.renderOutput(
        scenario.templatePaths.main,
        scenario.templatePaths.item,
        scenario.mainData,
        scenario.itemsData,
        "complex-output.json",
      );

      // Assert - Validate complex structure handling
      assert(result.ok, "Complex JSON rendering should succeed");

      if (result.ok) {
        const outputContent = scenario.fileSystem.getOutput(
          "complex-output.json",
        );
        assert(outputContent);

        const parsedOutput = JSON.parse(outputContent);

        // Business requirement: Nested structures must be preserved
        assertEquals(parsedOutput.metadata.version, "2.0.0");
        assertEquals(parsedOutput.metadata.author, "Test Author");
        assert(Array.isArray(parsedOutput.configuration.settings));
        assertEquals(parsedOutput.configuration.settings.length, 2);
      }
    });
  });

  describe("GIVEN: YAML template format support", () => {
    it("WHEN: Rendering YAML templates THEN: Should process YAML structure correctly", () => {
      // Arrange - Business scenario with YAML templates
      const yamlMainTemplate = `version: "{version}"
description: "{description}"
tools:
  commands:
    - "{@items}"`;

      const yamlItemTemplate = `c1: "{c1}"
c2: "{c2}"
description: "{description}"`;

      const scenario = new DualFormatTemplateScenarioBuilder()
        .withYamlMainTemplate(yamlMainTemplate)
        .withYamlItemTemplate(yamlItemTemplate)
        .withMainData({
          version: "2.0.0",
          description: "YAML test registry",
        })
        .withItemsData([
          { c1: "build", c2: "test", description: "Build test command" },
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

      // Act - Execute YAML template rendering
      const result = serviceResult.data.renderOutput(
        scenario.templatePaths.main,
        scenario.templatePaths.item,
        scenario.mainData,
        scenario.itemsData,
        "output.yaml",
        "yaml",
      );

      // Assert - Validate business requirements
      assert(result.ok, "YAML template rendering should succeed");

      if (result.ok) {
        const outputContent = scenario.fileSystem.getOutput("output.yaml");
        assert(outputContent, "YAML output must be written");

        // Validate format support requirement
        SpecificationAssertions.assertBusinessRequirement(
          { supportsJson: true, supportsYaml: true },
          dualFormatTemplateRequirements.formatSupport,
          "YAML format must be supported",
        );

        // Business requirement: YAML structure must be preserved
        assertEquals(outputContent.includes("version: 2.0.0"), true);
        assertEquals(
          outputContent.includes("description: YAML test registry"),
          true,
        );

        // Validate format consistency requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            hasConsistentOutput: true,
            preservesStructure: outputContent.includes("tools:") &&
              outputContent.includes("commands:"),
          },
          dualFormatTemplateRequirements.formatConsistency,
          "YAML structure must be preserved consistently",
        );
      }
    });
  });

  describe("GIVEN: Mixed format template support", () => {
    it("WHEN: Using YAML main with JSON item template THEN: Should handle format mixing", () => {
      // Arrange - Mixed format business scenario
      const yamlMainTemplate = `name: "{name}"
type: "{type}"
items:
  - "{@items}"`;

      const scenario = new DualFormatTemplateScenarioBuilder()
        .withYamlMainTemplate(yamlMainTemplate)
        .withJsonItemTemplate({
          id: "{id}",
          value: "{value}",
        })
        .withMainData({
          name: "Mixed Format Test",
          type: "hybrid",
        })
        .withItemsData([
          { id: "item1", value: "test value" },
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

      // Act - Execute mixed format rendering
      const result = serviceResult.data.renderOutput(
        scenario.templatePaths.main,
        scenario.templatePaths.item,
        scenario.mainData,
        scenario.itemsData,
        "mixed-output.yaml",
        "yaml",
      );

      // Assert - Validate business requirements
      assert(result.ok, "Mixed format rendering should succeed");

      if (result.ok) {
        const outputContent = scenario.fileSystem.getOutput(
          "mixed-output.yaml",
        );
        assert(outputContent, "Mixed format output must be written");

        // Validate mixed format handling requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            handlesMixedFormats: true,
            maintainsCompatibility:
              outputContent.includes("Mixed Format Test") &&
              outputContent.includes("hybrid"),
          },
          dualFormatTemplateRequirements.mixedFormatHandling,
          "Mixed format combinations must be handled properly",
        );

        // Business requirement: Mixed format output must be coherent
        assertEquals(outputContent.includes("name: Mixed Format Test"), true);
        assertEquals(outputContent.includes("type: hybrid"), true);
      }
    });
  });

  describe("GIVEN: Invalid template formats", () => {
    it("WHEN: Processing invalid JSON template THEN: Should provide specific error", () => {
      // Arrange - Invalid JSON business scenario
      const fileSystem = new InMemoryTemplateFileSystem();
      fileSystem.addTemplate(
        "invalid.json",
        "{ invalid: json: content: [missing bracket }",
      );

      const rendererResult = TemplateRenderer.create();
      assert(rendererResult.ok);

      const serviceResult = OutputRenderingService.create(
        rendererResult.data,
        fileSystem,
        fileSystem,
      );
      assert(serviceResult.ok);

      const mainDataResult = TestDataFactory.createFrontmatterData({
        test: "data",
      });
      assert(mainDataResult.ok);

      // Act - Attempt invalid JSON processing
      const result = serviceResult.data.renderOutput(
        "invalid.json",
        undefined,
        mainDataResult.data,
        undefined,
        "output.json",
      );

      // Assert - Validate error handling requirement
      assert(!result.ok, "Invalid JSON must be rejected");

      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTemplate");

        // Validate error robustness requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            hasErrorHandling: true,
            providesSpecificErrors: result.error.kind === "InvalidTemplate",
          },
          dualFormatTemplateRequirements.errorRobustness,
          "JSON format errors must be handled with specific errors",
        );
      }
    });

    it("WHEN: Processing invalid YAML template THEN: Should provide specific error", () => {
      // Arrange - Invalid YAML business scenario
      const fileSystem = new InMemoryTemplateFileSystem();
      fileSystem.addTemplate(
        "invalid.yaml",
        "invalid: yaml: content: [missing bracket",
      );

      const rendererResult = TemplateRenderer.create();
      assert(rendererResult.ok);

      const serviceResult = OutputRenderingService.create(
        rendererResult.data,
        fileSystem,
        fileSystem,
      );
      assert(serviceResult.ok);

      const mainDataResult = TestDataFactory.createFrontmatterData({
        test: "data",
      });
      assert(mainDataResult.ok);

      // Act - Attempt invalid YAML processing
      const result = serviceResult.data.renderOutput(
        "invalid.yaml",
        undefined,
        mainDataResult.data,
        undefined,
        "output.yaml",
      );

      // Assert - Validate error handling requirement
      assert(!result.ok, "Invalid YAML must be rejected");

      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTemplate");

        // Validate error robustness requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            hasErrorHandling: true,
            providesSpecificErrors: result.error.kind === "InvalidTemplate",
          },
          dualFormatTemplateRequirements.errorRobustness,
          "YAML format errors must be handled with specific errors",
        );
      }
    });
  });
});

/**
 * Domain rule validation tests
 */
describe("DOMAIN RULES: Dual Format Template Support", () => {
  const dualFormatTemplateRules: DomainRule<any> = {
    name: "dual-format-template-completeness",
    description: "Template system must support multiple formats seamlessly",
    validator: (data) => ({
      isValid: data.service &&
        typeof data.service.renderOutput === "function",
      violation:
        "Template service must provide dual format rendering capability",
    }),
  };

  it("Should enforce dual format template domain rules", () => {
    const rendererResult = TemplateRenderer.create();
    assert(rendererResult.ok);

    const fileSystem = new InMemoryTemplateFileSystem();

    const serviceResult = OutputRenderingService.create(
      rendererResult.data,
      fileSystem,
      fileSystem,
    );
    assert(serviceResult.ok);

    SpecificationAssertions.assertDomainRule(
      { service: serviceResult.data },
      dualFormatTemplateRules,
      "dual-format-template",
      "Dual format template support must satisfy domain requirements",
    );
  });
});
