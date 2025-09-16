/**
 * Unit tests for IdListGenerator domain service
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - IdListGenerator creation and generation functionality
 * - Command ID processing from frontmatter data
 * - Duplicate removal and sorting logic
 * - Statistics generation for command categories
 * - Error handling following Result<T,E> pattern
 * - Edge cases and input validation
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { IdListGenerator } from "../../../../../src/domain/command/services/id-list-generator.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

describe("IdListGenerator", () => {
  let generator: IdListGenerator;

  // Create generator instance for each test
  function createGenerator(): IdListGenerator {
    return new IdListGenerator();
  }

  // Helper to create test frontmatter data
  function createTestFrontmatterData(
    data: Record<string, unknown>,
  ): FrontmatterData {
    const result = FrontmatterData.create(data);
    if (!result.ok) {
      throw new Error("Failed to create test frontmatter data");
    }
    return result.data;
  }

  describe("generate", () => {
    describe("successful generation", () => {
      it("should generate ID list from single valid frontmatter", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.version, "1.0.0");
        assertEquals(data.source_directory, "/test/source");
        assertEquals(data.total_files, 1);
        assertEquals(data.id_list.length, 1);
        assertEquals(data.id_list[0], "build:create:project");

        // Check statistics
        assertEquals(data.statistics.unique_ids, 1);
        assertEquals(data.statistics.c1_categories.length, 1);
        assertEquals(data.statistics.c1_categories[0], "build");
        assertEquals(data.statistics.c2_actions.length, 1);
        assertEquals(data.statistics.c2_actions[0], "create");
        assertEquals(data.statistics.c3_targets.length, 1);
        assertEquals(data.statistics.c3_targets[0], "project");
      });

      it("should generate ID list from multiple valid frontmatter entries", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
          createTestFrontmatterData({
            c1: "test",
            c2: "run",
            c3: "unit",
          }),
          createTestFrontmatterData({
            c1: "deploy",
            c2: "release",
            c3: "production",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.total_files, 3);
        assertEquals(data.id_list.length, 3);
        assertEquals(data.id_list.includes("build:create:project"), true);
        assertEquals(data.id_list.includes("test:run:unit"), true);
        assertEquals(data.id_list.includes("deploy:release:production"), true);

        // Check statistics
        assertEquals(data.statistics.unique_ids, 3);
        assertEquals(data.statistics.c1_categories.length, 3);
        assertEquals(data.statistics.c2_actions.length, 3);
        assertEquals(data.statistics.c3_targets.length, 3);
      });

      it("should remove duplicate command IDs and maintain sorted order", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
          createTestFrontmatterData({
            c1: "test",
            c2: "run",
            c3: "unit",
          }),
          createTestFrontmatterData({
            c1: "build", // Duplicate
            c2: "create",
            c3: "project",
          }),
          createTestFrontmatterData({
            c1: "deploy",
            c2: "release",
            c3: "staging",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.total_files, 4); // All files processed
        assertEquals(data.id_list.length, 3); // But only 3 unique IDs
        assertEquals(data.statistics.unique_ids, 3);

        // Check sorted order (alphabetical by full ID)
        const expectedOrder = [
          "build:create:project",
          "deploy:release:staging",
          "test:run:unit",
        ];
        assertEquals(data.id_list, expectedOrder);
      });

      it("should generate correct statistics for complex data", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "frontend",
          }),
          createTestFrontmatterData({
            c1: "build", // Same c1, different c2/c3
            c2: "compile",
            c3: "backend",
          }),
          createTestFrontmatterData({
            c1: "test",
            c2: "run",
            c3: "frontend", // Same c3, different c1/c2
          }),
          createTestFrontmatterData({
            c1: "deploy",
            c2: "release",
            c3: "database",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const stats = result.data.statistics;
        assertEquals(stats.unique_ids, 4);

        // Check category collections are sorted and unique
        assertEquals(stats.c1_categories, ["build", "deploy", "test"]);
        assertEquals(stats.c2_actions, ["compile", "create", "release", "run"]);
        assertEquals(stats.c3_targets, ["backend", "database", "frontend"]);
      });

      it("should handle mixed valid and invalid frontmatter data", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
          createTestFrontmatterData({
            // Missing required fields - should be skipped
            title: "Invalid frontmatter",
            description: "No command ID fields",
          }),
          createTestFrontmatterData({
            c1: "test",
            c2: "run",
            c3: "unit",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.total_files, 3); // All files processed
        assertEquals(data.id_list.length, 2); // Only 2 valid IDs
        assertEquals(data.statistics.unique_ids, 2);
        assertEquals(data.id_list.includes("build:create:project"), true);
        assertEquals(data.id_list.includes("test:run:unit"), true);
      });

      it("should generate correct timestamp format", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertExists(data.generated_at);

        // Check if it's a valid ISO timestamp
        const timestamp = new Date(data.generated_at);
        assertEquals(isNaN(timestamp.getTime()), false);
        assertEquals(data.generated_at.includes("T"), true);
        assertEquals(data.generated_at.includes("Z"), true);
      });
    });

    describe("error handling", () => {
      it("should return error for empty frontmatter list", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData: FrontmatterData[] = [];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "EmptyInput");
        assertEquals(result.error.message, "No frontmatter data provided");
      });

      it("should return error when no valid command IDs found", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            title: "Document 1",
            description: "No command ID fields",
          }),
          createTestFrontmatterData({
            content: "Another document",
            author: "Test Author",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "AggregationFailed");
        assertEquals(
          result.error.message,
          "Aggregation failed: No valid command IDs found in frontmatter data",
        );
      });
    });

    describe("edge cases", () => {
      it("should handle single valid entry among many invalid ones", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({ invalid: "data1" }),
          createTestFrontmatterData({ invalid: "data2" }),
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
          createTestFrontmatterData({ invalid: "data3" }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.total_files, 4);
        assertEquals(data.id_list.length, 1);
        assertEquals(data.id_list[0], "build:create:project");
        assertEquals(data.statistics.unique_ids, 1);
      });

      it("should handle empty source directory path", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.source_directory, "");
        assertEquals(data.id_list.length, 1);
      });

      it("should handle all same command IDs (complete duplicates)", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData = [
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
          createTestFrontmatterData({
            c1: "build",
            c2: "create",
            c3: "project",
          }),
        ];

        // Act
        const result = generator.generate(frontmatterData, "/test/source");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.total_files, 3);
        assertEquals(data.id_list.length, 1);
        assertEquals(data.id_list[0], "build:create:project");
        assertEquals(data.statistics.unique_ids, 1);
        assertEquals(data.statistics.c1_categories.length, 1);
        assertEquals(data.statistics.c2_actions.length, 1);
        assertEquals(data.statistics.c3_targets.length, 1);
      });
    });

    describe("performance and efficiency", () => {
      it("should handle large number of entries efficiently", () => {
        // Arrange
        generator = createGenerator();
        const frontmatterData: FrontmatterData[] = [];

        // Generate 100 entries with some duplicates
        for (let i = 0; i < 100; i++) {
          const c1 = `category${i % 5}`; // 5 categories
          const c2 = `action${i % 10}`; // 10 actions
          const c3 = `target${i % 20}`; // 20 targets

          frontmatterData.push(createTestFrontmatterData({
            c1,
            c2,
            c3,
          }));
        }

        // Act
        const startTime = Date.now();
        const result = generator.generate(frontmatterData, "/test/source");
        const endTime = Date.now();

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const data = result.data;
        assertEquals(data.total_files, 100);

        // Should have removed duplicates efficiently
        assertEquals(data.id_list.length <= 100, true);
        assertEquals(data.statistics.unique_ids <= 100, true);

        // Performance check - should complete within reasonable time
        const executionTime = endTime - startTime;
        assertEquals(executionTime < 1000, true); // Less than 1 second

        // Check that all statistics are properly sorted
        const stats = data.statistics;
        const sortedC1 = [...stats.c1_categories].sort();
        const sortedC2 = [...stats.c2_actions].sort();
        const sortedC3 = [...stats.c3_targets].sort();

        assertEquals(stats.c1_categories, sortedC1);
        assertEquals(stats.c2_actions, sortedC2);
        assertEquals(stats.c3_targets, sortedC3);
      });
    });
  });
});
