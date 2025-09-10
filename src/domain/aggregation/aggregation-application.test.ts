/**
 * Data Application Aggregation Tests
 *
 * Tests data application functionality following AI complexity control (<200 lines)
 * Extracted from aggregation-service.test.ts for better organization
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createAggregationService } from "./aggregation-service.ts";
import {
  AggregatedResult,
  AggregationMetadataBuilder,
} from "./value-objects.ts";

describe("AggregationService - Data Application", () => {
  describe("applyAggregatedData()", () => {
    it("should apply aggregated data to a base object", () => {
      const service = createAggregationService();

      const baseData = {
        title: "Document Title",
        version: "1.0",
      };

      const aggregatedData = {
        allNames: ["Item 1", "Item 2", "Item 3"],
        totalCount: 3,
        categories: ["A", "B"],
      };

      const metadata = AggregationMetadataBuilder.basic(
        3,
        ["allNames", "totalCount", "categories"],
      );

      const aggregatedResultCreation = AggregatedResult.create(
        aggregatedData,
        metadata,
      );
      if (!aggregatedResultCreation.ok) {
        throw new Error("Failed to create aggregated result");
      }
      const result = service.applyAggregatedData(
        baseData,
        aggregatedResultCreation.data,
      );

      assertEquals(result.title, "Document Title");
      assertEquals(result.version, "1.0");
      assertEquals(result.allNames, ["Item 1", "Item 2", "Item 3"]);
      assertEquals(result.totalCount, 3);
      assertEquals(result.categories, ["A", "B"]);
    });

    it("should handle nested aggregated data structure", () => {
      const service = createAggregationService();

      const baseData = {
        document: {
          title: "Test Document",
        },
      };

      const aggregatedData = {
        "summary.userCount": 5,
        "summary.categories": ["tag1", "tag2"],
        "metadata.lastUpdated": "2023-01-01",
      };

      const metadata = AggregationMetadataBuilder.basic(
        10,
        [
          "summary.userCount",
          "summary.categories",
          "metadata.lastUpdated",
        ],
      );

      const aggregatedResultCreation = AggregatedResult.create(
        aggregatedData,
        metadata,
      );
      if (!aggregatedResultCreation.ok) {
        throw new Error("Failed to create aggregated result");
      }
      const aggregatedResult = aggregatedResultCreation.data;
      const result = service.applyAggregatedData(baseData, aggregatedResult);

      const document = result.document as Record<string, unknown>;
      const summary = result.summary as Record<string, unknown>;
      const resultMetadata = result.metadata as Record<string, unknown>;
      assertEquals(document.title, "Test Document");
      assertEquals(summary.userCount, 5);
      assertEquals(summary.categories, ["tag1", "tag2"]);
      assertEquals(resultMetadata.lastUpdated, "2023-01-01");
    });

    it("should preserve existing nested structures", () => {
      const service = createAggregationService();

      const baseData = {
        config: {
          version: "1.0",
          settings: {
            debug: true,
          },
        },
      };

      const aggregatedData = {
        "config.itemCount": 42,
        "config.settings.processedAt": "2023-01-01T00:00:00Z",
      };

      const metadata = AggregationMetadataBuilder.basic(
        5,
        ["config.itemCount", "config.settings.processedAt"],
      );

      const aggregatedResultCreation = AggregatedResult.create(
        aggregatedData,
        metadata,
      );
      if (!aggregatedResultCreation.ok) {
        throw new Error("Failed to create aggregated result");
      }
      const aggregatedResult = aggregatedResultCreation.data;
      const result = service.applyAggregatedData(baseData, aggregatedResult);

      const config = result.config as Record<string, unknown>;
      const settings = config.settings as Record<string, unknown>;
      assertEquals(config.version, "1.0");
      assertEquals(settings.debug, true);
      assertEquals(config.itemCount, 42);
      assertEquals(settings.processedAt, "2023-01-01T00:00:00Z");
    });

    it("should handle empty aggregated data", () => {
      const service = createAggregationService();

      const baseData = {
        title: "Document Title",
        content: "Some content",
      };

      const aggregatedData = {};
      const metadata = AggregationMetadataBuilder.basic(
        0,
        [],
      );

      const aggregatedResultCreation = AggregatedResult.create(
        aggregatedData,
        metadata,
      );
      if (!aggregatedResultCreation.ok) {
        throw new Error("Failed to create aggregated result");
      }
      const aggregatedResult = aggregatedResultCreation.data;
      const result = service.applyAggregatedData(baseData, aggregatedResult);

      assertEquals(result.title, "Document Title");
      assertEquals(result.content, "Some content");
    });

    it("should handle null base data gracefully", () => {
      const service = createAggregationService();

      const aggregatedData = {
        newProperty: "new value",
        nested: { prop: 123 },
      };

      const metadata = AggregationMetadataBuilder.basic(
        1,
        ["newProperty", "nested.prop"],
      );

      const aggregatedResultCreation = AggregatedResult.create(
        aggregatedData,
        metadata,
      );
      if (!aggregatedResultCreation.ok) {
        throw new Error("Failed to create aggregated result");
      }
      const aggregatedResult = aggregatedResultCreation.data;
      const result = service.applyAggregatedData({}, aggregatedResult);

      assertEquals(result.newProperty, "new value");
      const nested = result.nested as Record<string, unknown>;
      assertEquals(nested.prop, 123);
    });
  });
});
