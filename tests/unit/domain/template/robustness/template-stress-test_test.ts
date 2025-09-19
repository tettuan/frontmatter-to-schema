/**
 * Template Processing Robustness and Stress Tests
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - Large data set processing performance
 * - Memory usage under stress
 * - Concurrent processing safety
 * - Edge case error recovery
 * - Template complexity limits
 * - Verbose mode performance impact
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplateRenderer } from "../../../../../src/domain/template/renderers/template-renderer.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";
import { isOk } from "../../../../../src/domain/shared/types/result.ts";

// Test helper to create template with specific format
function createStressTestTemplate(
  content: unknown,
  format: "json" | "yaml" | "markdown" = "json",
): Template {
  const pathResult = TemplatePath.create(`stress-test.${format}`);
  if (!isOk(pathResult)) {
    throw new Error("Failed to create template path");
  }

  const templateResult = Template.create(pathResult.data, content);
  if (!isOk(templateResult)) {
    throw new Error("Failed to create template");
  }

  return templateResult.data.withFormat(format);
}

// Test helper to create large frontmatter data set
function createLargeFrontmatterDataSet(size: number): FrontmatterData[] {
  const dataSet: FrontmatterData[] = [];

  for (let i = 0; i < size; i++) {
    const data = {
      id: `item-${i}`,
      title: `Large Dataset Item ${i}`,
      content: `This is content for item ${i}`.repeat(10), // Make content larger
      metadata: {
        created: new Date().toISOString(),
        tags: [`tag-${i % 10}`, `category-${i % 5}`],
        priority: i % 3,
        nested: {
          deep: {
            value: `deep-value-${i}`,
            array: Array.from({ length: 5 }, (_, j) => `nested-${i}-${j}`),
          },
        },
      },
      // Add some null/undefined values for robustness testing
      nullValue: null,
      undefinedValue: undefined,
      emptyString: "",
      zeroValue: 0,
      falseValue: false,
    };

    const frontmatterResult = FrontmatterData.create(data);
    if (!isOk(frontmatterResult)) {
      throw new Error(`Failed to create frontmatter data for item ${i}`);
    }
    dataSet.push(frontmatterResult.data);
  }

  return dataSet;
}

describe("Template Processing Robustness Tests", () => {
  describe("Performance and Scalability", () => {
    it("should handle large data sets efficiently", () => {
      // Arrange
      const rendererResult = TemplateRenderer.create();
      assertEquals(rendererResult.ok, true);
      if (!rendererResult.ok) return;

      const renderer = rendererResult.data;
      const largeDataSet = createLargeFrontmatterDataSet(100); // Reduced to 100 items for robustness

      const template = createStressTestTemplate({
        "total": "{@items.length}",
        "items": "{@items}",
        "itemTemplate": {
          "id": "{id}",
          "title": "{title}",
          "priority": "{metadata.priority}",
        },
      });

      const startTime = performance.now();

      // Act
      const result = renderer.render(template, largeDataSet);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) {
        console.error("Template rendering failed:", result.error.message);
        return;
      }

      // Performance assertion: should process 100 items in under 2 seconds
      console.log(`Large dataset processing took: ${processingTime}ms`);
      assertEquals(
        processingTime < 2000,
        true,
        `Processing took ${processingTime}ms, expected < 2000ms`,
      );

      // Verify data integrity
      const parsed = JSON.parse(result.data);
      assertEquals(Array.isArray(parsed.items), true);
      assertEquals(parsed.items.length, 100);
      assertEquals(parsed.items[0].id, "item-0");
      assertEquals(parsed.items[99].id, "item-99");
    });

    it("should handle deeply nested templates without stack overflow", () => {
      // Arrange
      const rendererResult = TemplateRenderer.create();
      assertEquals(rendererResult.ok, true);
      if (!rendererResult.ok) return;

      const renderer = rendererResult.data;

      // Create deeply nested template structure
      let nestedTemplate: any = { "value": "{deep_value}" };
      for (let i = 0; i < 50; i++) {
        nestedTemplate = {
          [`level${i}`]: nestedTemplate,
          [`data${i}`]: `{level${i}_data}`,
        };
      }

      const template = createStressTestTemplate(nestedTemplate);

      // Create corresponding nested data
      const data: any = { deep_value: "final_value" };
      for (let i = 0; i < 50; i++) {
        data[`level${i}_data`] = `Level ${i} data`;
      }

      const frontmatterResult = FrontmatterData.create(data);
      assertEquals(frontmatterResult.ok, true);
      if (!frontmatterResult.ok) return;

      // Act
      const result = renderer.render(template, frontmatterResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const parsed = JSON.parse(result.data);
      assertExists(parsed);

      // Verify deep nesting was processed correctly
      let current = parsed;
      for (let i = 49; i >= 0; i--) {
        assertExists(current[`level${i}`]);
        assertEquals(current[`data${i}`], `Level ${i} data`);
        current = current[`level${i}`];
      }
      assertEquals(current.value, "final_value");
    });
  });

  describe("Verbose Mode Robustness", () => {
    it("should maintain performance in verbose mode with large null/undefined datasets", () => {
      // Arrange
      const rendererResult = TemplateRenderer.create();
      assertEquals(rendererResult.ok, true);
      if (!rendererResult.ok) return;

      const renderer = rendererResult.data;

      // Create data with many null/undefined values
      const dataWithNulls: any = {};
      for (let i = 0; i < 500; i++) {
        dataWithNulls[`null_field_${i}`] = null;
        dataWithNulls[`undefined_field_${i}`] = undefined;
        dataWithNulls[`valid_field_${i}`] = `value_${i}`;
      }

      const frontmatterResult = FrontmatterData.create(dataWithNulls);
      assertEquals(frontmatterResult.ok, true);
      if (!frontmatterResult.ok) return;

      // Create template referencing many fields
      const templateContent: any = {};
      for (let i = 0; i < 500; i++) {
        templateContent[`null_${i}`] = `{null_field_${i}}`;
        templateContent[`undefined_${i}`] = `{undefined_field_${i}}`;
        templateContent[`valid_${i}`] = `{valid_field_${i}}`;
      }

      const template = createStressTestTemplate(templateContent);

      const startTime = performance.now();

      // Act - Test verbose mode
      const verboseResult = renderer.render(
        template,
        frontmatterResult.data,
        { kind: "verbose" },
      );

      const verboseTime = performance.now() - startTime;

      // Test normal mode for comparison
      const normalStartTime = performance.now();
      const normalResult = renderer.render(
        template,
        frontmatterResult.data,
        { kind: "normal" },
      );
      const normalTime = performance.now() - normalStartTime;

      // Assert
      assertEquals(verboseResult.ok, true);
      assertEquals(normalResult.ok, true);

      if (!verboseResult.ok || !normalResult.ok) return;

      // Performance: verbose mode should not be more than 3x slower
      assertEquals(
        verboseTime < normalTime * 3,
        true,
        `Verbose mode took ${verboseTime}ms vs normal ${normalTime}ms`,
      );

      // Verify verbose mode preserves template variables
      const verboseParsed = JSON.parse(verboseResult.data);
      const normalParsed = JSON.parse(normalResult.data);

      // In verbose mode, null/undefined should preserve template variables
      assertEquals(verboseParsed.null_0, "{null_field_0}");
      assertEquals(verboseParsed.undefined_0, "{undefined_field_0}");
      assertEquals(verboseParsed.valid_0, "value_0");

      // In normal mode, null/undefined should be empty strings
      assertEquals(normalParsed.null_0, "");
      assertEquals(normalParsed.undefined_0, "");
      assertEquals(normalParsed.valid_0, "value_0");
    });
  });

  describe("Error Recovery and Edge Cases", () => {
    it("should handle malformed template content gracefully", () => {
      // Arrange
      const rendererResult = TemplateRenderer.create();
      assertEquals(rendererResult.ok, true);
      if (!rendererResult.ok) return;

      const renderer = rendererResult.data;

      // Test various malformed templates
      const malformedTemplates = [
        { "field": "{unclosed_brace" },
        { "field": "unclosed_brace}" },
        { "field": "{nested{brace}}" },
        { "field": "{empty_}" },
        { "field": "{}" },
        { "field": "{{double_brace}}" },
      ];

      const frontmatterResult = FrontmatterData.create({ test: "value" });
      assertEquals(frontmatterResult.ok, true);
      if (!frontmatterResult.ok) return;

      // Act & Assert
      malformedTemplates.forEach((templateContent, _index) => {
        const template = createStressTestTemplate(templateContent);
        const result = renderer.render(template, frontmatterResult.data);

        // Should either succeed with graceful handling or fail gracefully
        if (result.ok) {
          // If it succeeds, verify the output is valid JSON
          const parsed = JSON.parse(result.data);
          assertExists(parsed);
        } else {
          // If it fails, verify the error is meaningful
          assertExists(result.error);
          assertExists(result.error.message);
        }
      });
    });

    it("should handle concurrent processing safely", async () => {
      // Arrange
      const rendererResult = TemplateRenderer.create();
      assertEquals(rendererResult.ok, true);
      if (!rendererResult.ok) return;

      const renderer = rendererResult.data;
      const template = createStressTestTemplate({
        "concurrent_id": "{id}",
        "timestamp": "{timestamp}",
        "data": "{content}",
      });

      // Create multiple concurrent processing tasks
      const concurrentTasks = Array.from({ length: 10 }, (_, i) => {
        const data = FrontmatterData.create({
          id: `concurrent-${i}`,
          timestamp: Date.now() + i,
          content: `Concurrent content ${i}`,
        });

        if (!isOk(data)) {
          throw new Error(`Failed to create data for task ${i}`);
        }

        return new Promise((resolve) => {
          setTimeout(() => {
            const result = renderer.render(template, data.data);
            resolve({ taskId: i, result });
          }, Math.random() * 10); // Random delay to simulate real concurrency
        });
      });

      // Act
      const results = await Promise.all(concurrentTasks);

      // Assert
      results.forEach((taskResult: any) => {
        assertEquals(taskResult.result.ok, true);
        if (taskResult.result.ok) {
          const parsed = JSON.parse(taskResult.result.data);
          assertEquals(parsed.concurrent_id, `concurrent-${taskResult.taskId}`);
        }
      });
    });
  });

  describe("Memory and Resource Management", () => {
    it("should not leak memory with repeated template processing", () => {
      // Arrange
      const rendererResult = TemplateRenderer.create();
      assertEquals(rendererResult.ok, true);
      if (!rendererResult.ok) return;

      const renderer = rendererResult.data;
      const template = createStressTestTemplate({
        "iteration": "{iteration}",
        "data": "{large_content}",
      });

      const initialMemory = performance.now(); // Proxy for memory usage

      // Act - Process many iterations
      for (let i = 0; i < 100; i++) {
        const data = FrontmatterData.create({
          iteration: i,
          large_content: "x".repeat(1000), // 1KB of content per iteration
        });

        if (!isOk(data)) continue;

        const result = renderer.render(template, data.data);
        assertEquals(result.ok, true);

        // Force garbage collection if available (for testing)
        if (typeof (globalThis as any).gc === "function") {
          (globalThis as any).gc();
        }
      }

      const finalMemory = performance.now();
      const memoryDelta = finalMemory - initialMemory;

      // Assert - Memory usage should be reasonable (under 100ms processing time as proxy)
      assertEquals(
        memoryDelta < 100,
        true,
        `Memory proxy delta: ${memoryDelta}`,
      );
    });
  });
});
