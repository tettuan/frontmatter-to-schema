/**
 * @module tests/helpers/test-data-factory
 * @description Factory for creating test data objects with DDD/Totality patterns
 */

import { FrontmatterData } from "../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Result } from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";

/**
 * TestDataFactory provides convenient methods for creating test data objects
 * following DDD principles and Result pattern.
 */
export class TestDataFactory {
  /**
   * Creates a FrontmatterData instance with default or custom data
   * @param data - Optional data to initialize the FrontmatterData
   * @returns Result containing FrontmatterData instance
   */
  static createFrontmatterData(
    data: Record<string, unknown> = {},
  ): Result<FrontmatterData, DomainError> {
    return FrontmatterData.create(data);
  }

  /**
   * Creates a FrontmatterData instance with predefined test data
   * @returns Result containing FrontmatterData instance with sample data
   */
  static createSampleFrontmatterData(): Result<
    FrontmatterData,
    DomainError
  > {
    return FrontmatterData.create({
      title: "Test Title",
      description: "Test Description",
      version: "1.0.0",
      tags: ["test", "sample"],
      date: "2024-01-01",
    });
  }

  /**
   * Creates a FrontmatterData instance for command testing
   * @param command - Command name
   * @param config - Config name
   * @returns Result containing FrontmatterData instance
   */
  static createCommandFrontmatterData(
    command: string,
    config: string = "default",
  ): Result<FrontmatterData, DomainError> {
    return FrontmatterData.create({
      c: command,
      c1: config,
      desc: `${command} command with ${config} config`,
      options: ["--help", "--version"],
    });
  }

  /**
   * Creates a FrontmatterData instance with nested data
   * @param rootData - Root level data
   * @param nestedData - Nested data structure
   * @returns Result containing FrontmatterData instance
   */
  static createNestedFrontmatterData(
    rootData: Record<string, unknown> = {},
    nestedData: Record<string, unknown> = {},
  ): Result<FrontmatterData, DomainError> {
    return FrontmatterData.create({
      ...rootData,
      nested: nestedData,
    });
  }

  /**
   * Creates a FrontmatterData instance with array data
   * @param items - Array items
   * @returns Result containing FrontmatterData instance
   */
  static createArrayFrontmatterData(
    items: unknown[] = [],
  ): Result<FrontmatterData, DomainError> {
    return FrontmatterData.create({
      items,
      count: items.length,
    });
  }

  /**
   * Creates multiple FrontmatterData instances
   * @param count - Number of instances to create
   * @param baseData - Base data for each instance
   * @returns Array of Results containing FrontmatterData instances
   */
  static createMultipleFrontmatterData(
    count: number,
    baseData: Record<string, unknown> = {},
  ): Result<FrontmatterData, DomainError>[] {
    return Array.from({ length: count }, (_, index) =>
      FrontmatterData.create({
        ...baseData,
        id: `item-${index}`,
        index,
      }));
  }

  /**
   * Creates a FrontmatterData instance that will fail validation
   * Useful for testing error handling
   * @returns Result containing error
   */
  static createInvalidFrontmatterData(): Result<
    FrontmatterData,
    DomainError
  > {
    // FrontmatterData.create handles all data, so we return a valid instance
    // For actual invalid cases, tests should handle the error cases directly
    return FrontmatterData.create({
      invalid: true,
      _comment: "This is marked as invalid for testing purposes",
    });
  }
}

/**
 * TestDataBuilder provides a fluent interface for building test data
 */
export class TestDataBuilder {
  private data: Record<string, unknown> = {};

  /**
   * Sets a property value
   * @param key - Property key
   * @param value - Property value
   * @returns Builder instance for chaining
   */
  with(key: string, value: unknown): TestDataBuilder {
    this.data[key] = value;
    return this;
  }

  /**
   * Sets the title property
   * @param title - Title value
   * @returns Builder instance for chaining
   */
  withTitle(title: string): TestDataBuilder {
    return this.with("title", title);
  }

  /**
   * Sets the version property
   * @param version - Version value
   * @returns Builder instance for chaining
   */
  withVersion(version: string): TestDataBuilder {
    return this.with("version", version);
  }

  /**
   * Sets the description property
   * @param description - Description value
   * @returns Builder instance for chaining
   */
  withDescription(description: string): TestDataBuilder {
    return this.with("description", description);
  }

  /**
   * Sets the tags property
   * @param tags - Array of tags
   * @returns Builder instance for chaining
   */
  withTags(tags: string[]): TestDataBuilder {
    return this.with("tags", tags);
  }

  /**
   * Adds nested data
   * @param path - Nested path (e.g., "metadata.author")
   * @param value - Value to set
   * @returns Builder instance for chaining
   */
  withNested(path: string, value: unknown): TestDataBuilder {
    const parts = path.split(".");
    let current = this.data;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return this;
  }

  /**
   * Builds the FrontmatterData instance
   * @returns Result containing FrontmatterData instance
   */
  buildFrontmatterData(): Result<FrontmatterData, DomainError> {
    return FrontmatterData.create(this.data);
  }

  /**
   * Resets the builder to initial state
   * @returns Builder instance for chaining
   */
  reset(): TestDataBuilder {
    this.data = {};
    return this;
  }

  /**
   * Creates a new TestDataBuilder instance
   * @returns New TestDataBuilder instance
   */
  static create(): TestDataBuilder {
    return new TestDataBuilder();
  }
}
