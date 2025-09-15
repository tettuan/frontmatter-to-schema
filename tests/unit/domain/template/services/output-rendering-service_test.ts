import { assertEquals, assertExists } from "@std/assert";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { OutputRenderingService } from "../../../../../src/domain/template/services/output-rendering-service.ts";
import { TemplateRenderer } from "../../../../../src/domain/template/renderers/template-renderer.ts";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";
import { ok } from "../../../../../src/domain/shared/types/result.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

/**
 * CRITICAL SPECIFICATION TEST: Dual Template Rendering
 *
 * This test validates the core requirement for handling both x-template and x-template-items
 * as defined in the template processing specification.
 *
 * Key Requirements Validated:
 * 1. OutputRenderingService must accept two template paths:
 *    - x-template (main template for overall structure)
 *    - x-template-items (template for array items)
 *
 * 2. OutputRenderingService must accept two data inputs:
 *    - mainData (for main template variables)
 *    - itemsData (array of data for item templates)
 *
 * 3. Processing Flow:
 *    - Each item in itemsData is rendered using x-template-items
 *    - All rendered items are combined
 *    - Combined items are embedded into main template structure
 *    - Main template variables are replaced with mainData values
 *
 * 4. Variable Replacement:
 *    - All {{variable}} placeholders must be replaced with actual values
 *    - Two-layer template structure must be properly combined
 *    - Final output must be valid JSON with all variables resolved
 *
 * This test ensures the system can handle complex template hierarchies
 * as required for advanced schema processing scenarios.
 */
describe("OutputRenderingService - Dual Template Rendering", () => {
  let service: OutputRenderingService;
  let mockFileReader: any;
  let mockFileWriter: any;
  let templateRenderer: TemplateRenderer;

  beforeEach(() => {
    // Create template renderer
    const rendererResult = TemplateRenderer.create();
    assertExists(rendererResult.ok);
    if (!rendererResult.ok) throw new Error("Failed to create renderer");
    templateRenderer = rendererResult.data;

    // Mock file reader that returns template content
    mockFileReader = {
      read: (path: string) => {
        if (path === "main-template.json") {
          return ok(JSON.stringify({
            title: "Article Index",
            description: "{{description}}",
            totalCount: "{{totalCount}}",
            items: "{{items}}",
          }));
        }
        if (path === "item-template.json") {
          return ok(JSON.stringify({
            id: "{{id}}",
            name: "{{name}}",
            value: "{{value}}",
          }));
        }
        return ok("{}");
      },
    };

    // Mock file writer
    mockFileWriter = {
      write: (_path: string, _content: string) => ok(undefined),
    };

    const serviceResult = OutputRenderingService.create(
      templateRenderer,
      mockFileReader,
      mockFileWriter,
    );
    if (!serviceResult.ok) {
      throw new Error(`Failed to create OutputRenderingService`);
    }
    service = serviceResult.data;
  });

  describe("renderOutput with x-template and x-template-items", () => {
    /**
     * SPECIFICATION TEST CASE 1: Dual Template with Variable Replacement
     *
     * Validates the complete dual-template rendering pipeline:
     * - x-template defines overall structure with placeholders
     * - x-template-items defines item structure
     * - Both templates use {{variable}} syntax
     * - Variables are replaced with actual values
     * - Items are rendered individually then combined
     * - Final structure is a properly nested JSON
     */
    it("should render two-layer template structure with replaced variables", () => {
      // Prepare main data
      const mainDataResult = TestDataFactory.createFrontmatterData({
        description: "Test Articles",
        totalCount: 3,
      });
      assertExists(mainDataResult.ok);
      if (!mainDataResult.ok) throw new Error("Failed to create main data");
      const mainData = mainDataResult.data;

      // Prepare items data array
      const itemsData: FrontmatterData[] = [];
      for (let i = 1; i <= 3; i++) {
        const itemResult = TestDataFactory.createFrontmatterData({
          id: `item-${i}`,
          name: `Item ${i}`,
          value: i * 100,
        });
        assertExists(itemResult.ok);
        if (!itemResult.ok) throw new Error("Failed to create item data");
        itemsData.push(itemResult.data);
      }

      // Create spy to capture written content
      let capturedContent = "";
      mockFileWriter.write = (_path: string, content: string) => {
        capturedContent = content;
        return ok(undefined);
      };

      // Execute renderOutput with both templates
      const result = service.renderOutput(
        "main-template.json", // x-template
        "item-template.json", // x-template-items
        mainData, // main template data
        itemsData, // items template data array
        "output.json",
      );

      // CRITICAL ASSERTION: Rendering must succeed
      assertExists(result.ok, "Rendering should succeed");

      // Parse and verify the output structure
      const output = JSON.parse(capturedContent);

      // SPECIFICATION VALIDATION: Main template variables must be replaced
      assertEquals(
        output.title,
        "Article Index",
        "Title should be from template",
      );
      assertEquals(
        output.description,
        "Test Articles",
        "Description should be replaced",
      );
      assertEquals(output.totalCount, "3", "Total count should be replaced");

      // SPECIFICATION VALIDATION: Two-layer structure must be properly combined
      assertExists(output.items, "Items should exist");
      const items = Array.isArray(output.items)
        ? output.items
        : JSON.parse(output.items);
      assertEquals(items.length, 3, "Should have 3 items");

      // SPECIFICATION VALIDATION: Each item's variables must be replaced
      // This validates that x-template-items was properly applied to each item
      assertEquals(items[0].id, "item-1", "First item ID should be replaced");
      assertEquals(
        items[0].name,
        "Item 1",
        "First item name should be replaced",
      );
      assertEquals(
        items[0].value,
        "100",
        "First item value should be replaced",
      );

      assertEquals(items[1].id, "item-2", "Second item ID should be replaced");
      assertEquals(
        items[1].name,
        "Item 2",
        "Second item name should be replaced",
      );
      assertEquals(
        items[1].value,
        "200",
        "Second item value should be replaced",
      );

      assertEquals(items[2].id, "item-3", "Third item ID should be replaced");
      assertEquals(
        items[2].name,
        "Item 3",
        "Third item name should be replaced",
      );
      assertEquals(
        items[2].value,
        "300",
        "Third item value should be replaced",
      );
    });

    /**
     * SPECIFICATION TEST CASE 2: Backward Compatibility
     *
     * Ensures the system maintains backward compatibility when only
     * x-template is provided (without x-template-items).
     * This is critical for existing schemas that don't use dual templates.
     */
    it("should handle single template when items template is not provided", () => {
      const mainDataResult = TestDataFactory.createFrontmatterData({
        title: "Single Template",
        content: "Test content",
      });
      assertExists(mainDataResult.ok);
      if (!mainDataResult.ok) throw new Error("Failed to create main data");
      const mainData = mainDataResult.data;

      mockFileReader.read = (path: string) => {
        if (path === "single-template.json") {
          return ok(JSON.stringify({
            title: "{{title}}",
            content: "{{content}}",
          }));
        }
        return ok("{}");
      };

      let capturedContent = "";
      mockFileWriter.write = (_path: string, content: string) => {
        capturedContent = content;
        return ok(undefined);
      };

      const result = service.renderOutput(
        "single-template.json",
        undefined, // No items template
        mainData,
        undefined, // No items data
        "output.json",
      );

      assertExists(result.ok, "Single template rendering should succeed");

      const output = JSON.parse(capturedContent);
      assertEquals(output.title, "Single Template", "Title should be replaced");
      assertEquals(
        output.content,
        "Test content",
        "Content should be replaced",
      );
    });
  });
});
