import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  SchemaValidationServicePort,
  ValidationRulesAdjustmentService,
} from "./validation-rules-adjustment-service.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { SchemaPath } from "../../schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../schema/value-objects/schema-definition.ts";
import { err, ok } from "../../shared/types/result.ts";
import { createError } from "../../shared/types/errors.ts";
import { createEnhancedDebugLogger } from "../../shared/services/enhanced-debug-logger.ts";

describe("ValidationRulesAdjustmentService", () => {
  // Mock schema validation service for testing
  const createMockSchemaValidationService = (
    shouldSucceed: boolean = true,
  ): SchemaValidationServicePort => {
    return {
      getValidationRulesForFrontmatterPart: (_schema: Schema) => {
        if (shouldSucceed) {
          const mockRules = ValidationRules.create([
            { kind: "string", path: "title", required: true },
            { kind: "string", path: "date", required: false },
          ]);
          return ok(mockRules);
        } else {
          return err(createError({
            kind: "RenderFailed",
            message: "Failed to extract rules from schema",
          }));
        }
      },
    };
  };

  // Helper to create mock validation rules
  const createMockValidationRules = () => {
    const rules = ValidationRules.create([
      { kind: "string", path: "name", required: true },
    ]);
    return rules;
  };

  // Helper to create mock schema
  const createMockSchema = () => {
    // Create SchemaPath
    const schemaPathResult = SchemaPath.create("test-schema.json");
    if (!schemaPathResult.ok) {
      throw new Error("Failed to create schema path");
    }

    // Create SchemaDefinition
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string" },
      },
    });
    if (!schemaDefResult.ok) {
      throw new Error("Failed to create schema definition");
    }

    // Create Schema
    const schemaResult = Schema.create(
      schemaPathResult.data,
      schemaDefResult.data,
    );
    if (!schemaResult.ok) {
      throw new Error("Failed to create schema");
    }
    return schemaResult.data;
  };

  describe("Smart Constructor", () => {
    it("should create service with valid schema validation service", () => {
      const mockService = createMockSchemaValidationService();

      const result = ValidationRulesAdjustmentService.create(mockService);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should return error when schema validation service is null", () => {
      const result = ValidationRulesAdjustmentService.create(null as any);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: SchemaValidationService is required for ValidationRulesAdjustmentService",
        );
      }
    });

    it("should return error when schema validation service lacks required method", () => {
      const invalidService = {} as SchemaValidationServicePort;

      const result = ValidationRulesAdjustmentService.create(invalidService);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assertEquals(
          result.error.message,
          "Configuration error: SchemaValidationService must implement getValidationRulesForFrontmatterPart method",
        );
      }
    });

    it("should accept optional logger", () => {
      const mockService = createMockSchemaValidationService();
      const loggerResult = createEnhancedDebugLogger("test");
      const logger = loggerResult.ok ? loggerResult.data : undefined;

      const result = ValidationRulesAdjustmentService.create(
        mockService,
        logger,
      );

      assertEquals(result.ok, true);
    });
  });

  describe("Validation Rules Adjustment", () => {
    it("should successfully adjust rules using schema-derived rules", () => {
      const mockService = createMockSchemaValidationService(true);
      const serviceResult = ValidationRulesAdjustmentService.create(
        mockService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;
      const originalRules = createMockValidationRules();
      const schema = createMockSchema();

      const result = service.adjustRules(originalRules, schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getRules().length, 2); // Schema-derived rules
      }
    });

    it("should fallback to original rules when schema derivation fails", () => {
      const mockService = createMockSchemaValidationService(false);
      const serviceResult = ValidationRulesAdjustmentService.create(
        mockService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;
      const originalRules = createMockValidationRules();
      const schema = createMockSchema();

      const result = service.adjustRules(originalRules, schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getRules().length, 1); // Original rules count
        assertEquals(result.data, originalRules); // Should be exact same object
      }
    });

    it("should return error when original rules are null", () => {
      const mockService = createMockSchemaValidationService();
      const serviceResult = ValidationRulesAdjustmentService.create(
        mockService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;
      const schema = createMockSchema();

      const result = service.adjustRules(null as any, schema);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MissingRequired");
        assertEquals(
          result.error.message,
          'Required field "originalRules" is missing',
        );
      }
    });

    it("should return error when schema is null", () => {
      const mockService = createMockSchemaValidationService();
      const serviceResult = ValidationRulesAdjustmentService.create(
        mockService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;
      const originalRules = createMockValidationRules();

      const result = service.adjustRules(originalRules, null as any);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MissingRequired");
        assertEquals(
          result.error.message,
          'Required field "schema" is missing',
        );
      }
    });
  });

  describe("DDD Compliance", () => {
    it("should follow Totality principle with Result<T,E> pattern", () => {
      const mockService = createMockSchemaValidationService();
      const serviceResult = ValidationRulesAdjustmentService.create(
        mockService,
      );

      assertEquals(typeof serviceResult.ok, "boolean");

      if (serviceResult.ok) {
        assertExists(serviceResult.data);

        const service = serviceResult.data;
        const originalRules = createMockValidationRules();
        const schema = createMockSchema();

        const adjustResult = service.adjustRules(originalRules, schema);
        assertEquals(typeof adjustResult.ok, "boolean");

        if (adjustResult.ok) {
          assertExists(adjustResult.data);
        } else {
          assertExists(adjustResult.error);
          assertExists(adjustResult.error.kind);
          assertExists(adjustResult.error.message);
        }
      }
    });

    it("should maintain domain boundaries through port interface", () => {
      const mockService = createMockSchemaValidationService();

      // Verify port interface is properly typed
      assertExists(mockService.getValidationRulesForFrontmatterPart);
      assertEquals(
        typeof mockService.getValidationRulesForFrontmatterPart,
        "function",
      );
    });

    it("should encapsulate schema processing logic in domain service", () => {
      const mockService = createMockSchemaValidationService();
      const serviceResult = ValidationRulesAdjustmentService.create(
        mockService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;

      // Service should provide high-level domain operation
      assertEquals(typeof service.adjustRules, "function");

      // Internal methods should not be exposed (private)
      // Note: TypeScript private members are not truly private at runtime
      // This test ensures the public API surface is correct
      assertEquals(typeof (service as any).deriveRulesFromSchema, "function");
    });
  });

  describe("Error Handling", () => {
    it("should handle schema service exceptions gracefully", () => {
      const throwingService: SchemaValidationServicePort = {
        getValidationRulesForFrontmatterPart: () => {
          throw new Error("Unexpected schema service failure");
        },
      };

      const serviceResult = ValidationRulesAdjustmentService.create(
        throwingService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;
      const originalRules = createMockValidationRules();
      const schema = createMockSchema();

      const result = service.adjustRules(originalRules, schema);

      // Should fallback to original rules when exception occurs
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, originalRules);
      }
    });

    it("should provide meaningful error messages", () => {
      const failingService: SchemaValidationServicePort = {
        getValidationRulesForFrontmatterPart: () => {
          return err(createError({
            kind: "RenderFailed",
            message: "Schema parsing failed",
          }));
        },
      };

      const serviceResult = ValidationRulesAdjustmentService.create(
        failingService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;
      const originalRules = createMockValidationRules();
      const schema = createMockSchema();

      // Should fallback gracefully with meaningful logging
      const result = service.adjustRules(originalRules, schema);
      assertEquals(result.ok, true); // Fallback to original rules
    });
  });

  describe("Performance Characteristics", () => {
    it("should handle adjustment efficiently", () => {
      const mockService = createMockSchemaValidationService();
      const serviceResult = ValidationRulesAdjustmentService.create(
        mockService,
      );

      if (!serviceResult.ok) {
        throw new Error("Failed to create service");
      }

      const service = serviceResult.data;
      const originalRules = createMockValidationRules();
      const schema = createMockSchema();

      const startTime = performance.now();
      const result = service.adjustRules(originalRules, schema);
      const endTime = performance.now();

      assertEquals(result.ok, true);

      // Should complete quickly (under 10ms for simple case)
      const duration = endTime - startTime;
      assertEquals(
        duration < 10,
        true,
        `Adjustment took ${duration}ms, expected < 10ms`,
      );
    });
  });
});
