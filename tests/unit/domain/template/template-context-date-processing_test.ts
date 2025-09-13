/**
 * TemplateContext Date Processing Tests
 *
 * Tests for Issue #726: Date Fields Return Empty Objects Instead of ISO8601 Strings
 * Validates that Date objects are properly serialized to ISO8601 format in template processing
 */

import { assertEquals, assertExists } from "@std/assert";
import { TemplateContext } from "../../../../src/domain/template/template-context.ts";
import type { ValidatedData } from "../../../../src/domain/schema/schema-context.ts";
import type { TemplateConfig } from "../../../../src/domain/template/template-context.ts";
import { SchemaPath } from "../../../../src/domain/value-objects/schema-path.ts";

Deno.test("TemplateContext Date Processing", async (t) => {
  const templateContext = new TemplateContext();

  // Helper function to create ValidatedData with proper SchemaPath
  const createValidatedData = (
    data: Record<string, unknown>,
    schemaPath?: string,
  ): ValidatedData => {
    const pathToUse = schemaPath || "/test/schema.json";
    const schemaPathResult = SchemaPath.create(pathToUse);
    if (!schemaPathResult.ok) {
      throw new Error("Failed to create test schema path");
    }
    return {
      data,
      schemaPath: schemaPathResult.data,
      validationResult: {
        valid: true,
        errors: [],
        warnings: [],
      },
    };
  };

  await t.step(
    "should render Date objects as ISO8601 strings in JSON templates",
    () => {
      // Arrange: ValidatedData with Date field
      const dateValue = new Date("2024-01-15T00:00:00Z");
      const validatedData = createValidatedData({
        published_date: dateValue,
        title: "Test Article",
        author: "Test Author",
      });

      const templateConfig: TemplateConfig = {
        definition: JSON.stringify(
          {
            title: "{title}",
            author: "{author}",
            published_date: "{published_date}",
            metadata: {
              processing_date: "{published_date}",
            },
          },
          null,
          2,
        ),
        format: "json",
      };

      // Act
      const result = templateContext.renderTemplate(
        validatedData,
        templateConfig,
      );

      // Assert
      assertExists(result.ok, "Template rendering should succeed");
      if (result.ok) {
        const renderedData = JSON.parse(result.data.content);
        assertEquals(
          renderedData.published_date,
          "2024-01-15T00:00:00.000Z",
          "Date should be ISO8601 string",
        );
        assertEquals(
          renderedData.metadata.processing_date,
          "2024-01-15T00:00:00.000Z",
          "Nested date should be ISO8601 string",
        );
        assertEquals(
          renderedData.title,
          "Test Article",
          "String fields should remain unchanged",
        );
        assertEquals(
          renderedData.author,
          "Test Author",
          "Author field should be preserved",
        );
      }
    },
  );

  await t.step("should handle invalid Date objects gracefully", () => {
    // Arrange: ValidatedData with invalid Date
    const invalidDate = new Date("invalid-date-string");
    const validatedData = createValidatedData({
      published_date: invalidDate,
      title: "Test Article",
    });

    const templateConfig: TemplateConfig = {
      definition: JSON.stringify(
        {
          title: "{title}",
          published_date: "{published_date}",
        },
        null,
        2,
      ),
      format: "json",
    };

    // Act
    const result = templateContext.renderTemplate(
      validatedData,
      templateConfig,
    );

    // Assert
    assertExists(
      result.ok,
      "Template rendering should succeed even with invalid dates",
    );
    if (result.ok) {
      const renderedData = JSON.parse(result.data.content);
      assertEquals(
        renderedData.published_date,
        "",
        "Invalid date should render as empty string",
      );
      assertEquals(
        renderedData.title,
        "Test Article",
        "Other fields should remain unaffected",
      );
    }
  });

  await t.step(
    "should render Date objects as ISO8601 strings in non-JSON templates",
    () => {
      // Arrange: ValidatedData with Date field
      const dateValue = new Date("2024-02-20T10:30:45Z");
      const validatedData = createValidatedData({
        event_date: dateValue,
        event_name: "Conference 2024",
      });

      const templateConfig: TemplateConfig = {
        definition:
          "Event: {event_name}\nDate: {event_date}\nGenerated at: {event_date}",
        format: "custom",
      };

      // Act
      const result = templateContext.renderTemplate(
        validatedData,
        templateConfig,
      );

      // Assert
      assertExists(result.ok, "Template rendering should succeed");
      if (result.ok) {
        const content = result.data.content;
        assertEquals(
          content.includes("Date: 2024-02-20T10:30:45.000Z"),
          true,
          "Date should be rendered as ISO8601",
        );
        assertEquals(
          content.includes("Generated at: 2024-02-20T10:30:45.000Z"),
          true,
          "Repeated date references should work",
        );
        assertEquals(
          content.includes("Event: Conference 2024"),
          true,
          "Non-date fields should work normally",
        );
      }
    },
  );

  await t.step(
    "should handle multiple Date fields in the same template",
    () => {
      // Arrange: ValidatedData with multiple Date fields
      const publishDate = new Date("2024-01-15T00:00:00Z");
      const updateDate = new Date("2024-03-10T15:30:00Z");
      const validatedData = createValidatedData({
        published_date: publishDate,
        updated_date: updateDate,
        title: "Multi-Date Article",
      });

      const templateConfig: TemplateConfig = {
        definition: JSON.stringify(
          {
            title: "{title}",
            dates: {
              published: "{published_date}",
              updated: "{updated_date}",
            },
            timeline: [
              "{published_date}",
              "{updated_date}",
            ],
          },
          null,
          2,
        ),
        format: "json",
      };

      // Act
      const result = templateContext.renderTemplate(
        validatedData,
        templateConfig,
      );

      // Assert
      assertExists(result.ok, "Template rendering should succeed");
      if (result.ok) {
        const renderedData = JSON.parse(result.data.content);
        assertEquals(
          renderedData.dates.published,
          "2024-01-15T00:00:00.000Z",
          "Published date should be ISO8601",
        );
        assertEquals(
          renderedData.dates.updated,
          "2024-03-10T15:30:00.000Z",
          "Updated date should be ISO8601",
        );
        assertEquals(
          renderedData.timeline[0],
          "2024-01-15T00:00:00.000Z",
          "Array date 1 should be ISO8601",
        );
        assertEquals(
          renderedData.timeline[1],
          "2024-03-10T15:30:00.000Z",
          "Array date 2 should be ISO8601",
        );
      }
    },
  );

  await t.step("should handle Date objects in nested object structures", () => {
    // Arrange: ValidatedData with nested Date objects
    const validatedData = createValidatedData({
      article: {
        metadata: {
          created: new Date("2024-04-01T09:00:00Z"),
          modified: new Date("2024-04-15T14:30:00Z"),
        },
        title: "Nested Date Test",
      },
    });

    const templateConfig: TemplateConfig = {
      definition: JSON.stringify(
        {
          title: "{article.title}",
          created_at: "{article.metadata.created}",
          modified_at: "{article.metadata.modified}",
        },
        null,
        2,
      ),
      format: "json",
    };

    // Act
    const result = templateContext.renderTemplate(
      validatedData,
      templateConfig,
    );

    // Assert
    assertExists(result.ok, "Template rendering should succeed");
    if (result.ok) {
      const renderedData = JSON.parse(result.data.content);
      assertEquals(
        renderedData.created_at,
        "2024-04-01T09:00:00.000Z",
        "Nested created date should be ISO8601",
      );
      assertEquals(
        renderedData.modified_at,
        "2024-04-15T14:30:00.000Z",
        "Nested modified date should be ISO8601",
      );
      assertEquals(
        renderedData.title,
        "Nested Date Test",
        "Nested string should work",
      );
    }
  });

  await t.step("should preserve Date type info in bypass detection", () => {
    // Arrange: Simple date template
    const validatedData = createValidatedData({
      timestamp: new Date("2024-05-20T12:00:00Z"),
    });

    const templateConfig: TemplateConfig = {
      definition: JSON.stringify({ when: "{timestamp}" }),
      format: "json",
    };

    // Act
    const result = templateContext.renderTemplate(
      validatedData,
      templateConfig,
    );

    // Assert
    assertExists(result.ok, "Template rendering should succeed");
    if (result.ok) {
      assertEquals(
        result.data.templateProcessed,
        true,
        "Template should be marked as processed",
      );
      assertEquals(
        result.data.bypassDetected,
        false,
        "No bypass should be detected",
      );
      assertExists(result.data.renderTime, "Render time should be recorded");
      assertEquals(
        result.data.variables.includes("timestamp"),
        true,
        "Date variable should be tracked",
      );
    }
  });

  await t.step("should handle timezone variations in Date objects", () => {
    // Arrange: Date with different timezone representations
    const utcDate = new Date("2024-06-15T08:30:00Z");
    const isoDate = new Date("2024-06-15T08:30:00.000Z");

    const validatedData = createValidatedData({
      utc_time: utcDate,
      iso_time: isoDate,
    });

    const templateConfig: TemplateConfig = {
      definition: JSON.stringify({
        utc: "{utc_time}",
        iso: "{iso_time}",
      }),
      format: "json",
    };

    // Act
    const result = templateContext.renderTemplate(
      validatedData,
      templateConfig,
    );

    // Assert
    assertExists(result.ok, "Template rendering should succeed");
    if (result.ok) {
      const renderedData = JSON.parse(result.data.content);
      assertEquals(
        renderedData.utc,
        "2024-06-15T08:30:00.000Z",
        "UTC date should be consistent ISO8601",
      );
      assertEquals(
        renderedData.iso,
        "2024-06-15T08:30:00.000Z",
        "ISO date should be consistent ISO8601",
      );
      assertEquals(
        renderedData.utc,
        renderedData.iso,
        "Both representations should be identical",
      );
    }
  });

  await t.step("should handle Date arrays correctly", () => {
    // Arrange: ValidatedData with Date array
    const dates = [
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-06-01T00:00:00Z"),
      new Date("2024-12-01T00:00:00Z"),
    ];

    const validatedData = createValidatedData({
      milestones: dates,
    });

    const templateConfig: TemplateConfig = {
      definition: JSON.stringify({
        schedule: "{milestones}",
      }),
      format: "json",
    };

    // Act
    const result = templateContext.renderTemplate(
      validatedData,
      templateConfig,
    );

    // Assert
    assertExists(result.ok, "Template rendering should succeed");
    if (result.ok) {
      const renderedData = JSON.parse(result.data.content);
      const schedule = renderedData.schedule;
      assertEquals(
        Array.isArray(schedule),
        true,
        "Schedule should be an array",
      );
      assertEquals(schedule.length, 3, "Should have 3 dates");
      assertEquals(
        schedule[0],
        "2024-01-01T00:00:00.000Z",
        "First date should be ISO8601",
      );
      assertEquals(
        schedule[1],
        "2024-06-01T00:00:00.000Z",
        "Second date should be ISO8601",
      );
      assertEquals(
        schedule[2],
        "2024-12-01T00:00:00.000Z",
        "Third date should be ISO8601",
      );
    }
  });
});
