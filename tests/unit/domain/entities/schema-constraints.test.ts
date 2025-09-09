/**
 * Unit tests for SchemaConstraints entity
 * Testing constraint extraction and file filtering logic
 * Following Totality principles and DDD testing patterns
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1.0.11";
import { describe, it } from "jsr:@std/testing@1.0.7/bdd";
import { SchemaConstraints } from "../../../../src/domain/entities/schema-constraints.ts";

describe("SchemaConstraints", () => {
  describe("extract", () => {
    it("should successfully extract const constraint from schema", () => {
      const schema = {
        properties: {
          traceability: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "object",
                  properties: {
                    level: { type: "string", const: "design" },
                  },
                },
              },
            },
          },
        },
      };

      const result = SchemaConstraints.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const paths = result.data.getConstraintPaths();
        assertEquals(paths.includes("traceability.id.level"), true);
      }
    });

    it("should handle simple property const constraint", () => {
      const schema = {
        properties: {
          status: { type: "string", const: "active" },
        },
      };

      const result = SchemaConstraints.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const paths = result.data.getConstraintPaths();
        assertEquals(paths.includes("status"), true);
      }
    });

    it("should handle nested object properties", () => {
      const schema = {
        properties: {
          id: {
            type: "object",
            properties: {
              level: { type: "string", const: "design" },
            },
          },
        },
      };

      const result = SchemaConstraints.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const paths = result.data.getConstraintPaths();
        assertEquals(paths.includes("id.level"), true);
      }
    });

    it("should return error for invalid schema", () => {
      const result = SchemaConstraints.extract("invalid");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    });

    it("should return error for null schema", () => {
      const result = SchemaConstraints.extract(null);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    });

    it("should handle enum constraints", () => {
      const schema = {
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      };

      const result = SchemaConstraints.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const paths = result.data.getConstraintPaths();
        assertEquals(paths.includes("priority"), true);
      }
    });

    it("should handle pattern constraints", () => {
      const schema = {
        properties: {
          version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        },
      };

      const result = SchemaConstraints.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const paths = result.data.getConstraintPaths();
        assertEquals(paths.includes("version"), true);
      }
    });
  });

  describe("shouldProcessFile", () => {
    it("should allow file matching const constraint", () => {
      const schema = {
        properties: {
          traceability: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "object",
                  properties: {
                    level: { type: "string", const: "design" },
                  },
                },
              },
            },
          },
        },
      };

      const constraintsResult = SchemaConstraints.extract(schema);
      assertEquals(constraintsResult.ok, true);

      if (constraintsResult.ok) {
        const fileData = {
          traceability: [{
            id: { level: "design", scope: "ui", semantic: "dashboard" },
          }],
        };

        const filterResult = constraintsResult.data.shouldProcessFile(fileData);
        assertEquals(filterResult.ok, true);
        if (filterResult.ok) {
          assertEquals(filterResult.data.shouldProcess, true);
        }
      }
    });

    it("should reject file not matching const constraint", () => {
      const schema = {
        properties: {
          traceability: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "object",
                  properties: {
                    level: { type: "string", const: "design" },
                  },
                },
              },
            },
          },
        },
      };

      const constraintsResult = SchemaConstraints.extract(schema);
      assertEquals(constraintsResult.ok, true);

      if (constraintsResult.ok) {
        const fileData = {
          traceability: [{
            id: { level: "req", scope: "workflow", semantic: "automation" },
          }],
        };

        const filterResult = constraintsResult.data.shouldProcessFile(fileData);
        assertEquals(filterResult.ok, true);
        if (filterResult.ok) {
          assertEquals(filterResult.data.shouldProcess, false);
          assertExists(filterResult.data.reason);
        }
      }
    });

    it("should handle simple nested property constraints", () => {
      const schema = {
        properties: {
          id: {
            type: "object",
            properties: {
              level: { type: "string", const: "design" },
            },
          },
        },
      };

      const constraintsResult = SchemaConstraints.extract(schema);
      assertEquals(constraintsResult.ok, true);

      if (constraintsResult.ok) {
        // Should match
        const matchingData = { id: { level: "design" } };
        const matchResult = constraintsResult.data.shouldProcessFile(
          matchingData,
        );
        assertEquals(matchResult.ok, true);
        if (matchResult.ok) {
          assertEquals(matchResult.data.shouldProcess, true);
        }

        // Should not match
        const nonMatchingData = { id: { level: "req" } };
        const noMatchResult = constraintsResult.data.shouldProcessFile(
          nonMatchingData,
        );
        assertEquals(noMatchResult.ok, true);
        if (noMatchResult.ok) {
          assertEquals(noMatchResult.data.shouldProcess, false);
        }
      }
    });

    it("should handle enum constraints", () => {
      const schema = {
        properties: {
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      };

      const constraintsResult = SchemaConstraints.extract(schema);
      assertEquals(constraintsResult.ok, true);

      if (constraintsResult.ok) {
        // Should match valid enum value
        const validData = { priority: "high" };
        const validResult = constraintsResult.data.shouldProcessFile(validData);
        assertEquals(validResult.ok, true);
        if (validResult.ok) {
          assertEquals(validResult.data.shouldProcess, true);
        }

        // Should not match invalid enum value
        const invalidData = { priority: "critical" };
        const invalidResult = constraintsResult.data.shouldProcessFile(
          invalidData,
        );
        assertEquals(invalidResult.ok, true);
        if (invalidResult.ok) {
          assertEquals(invalidResult.data.shouldProcess, false);
        }
      }
    });

    it("should handle pattern constraints", () => {
      const schema = {
        properties: {
          version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        },
      };

      const constraintsResult = SchemaConstraints.extract(schema);
      assertEquals(constraintsResult.ok, true);

      if (constraintsResult.ok) {
        // Should match valid version pattern
        const validData = { version: "1.2.3" };
        const validResult = constraintsResult.data.shouldProcessFile(validData);
        assertEquals(validResult.ok, true);
        if (validResult.ok) {
          assertEquals(validResult.data.shouldProcess, true);
        }

        // Should not match invalid version pattern
        const invalidData = { version: "invalid" };
        const invalidResult = constraintsResult.data.shouldProcessFile(
          invalidData,
        );
        assertEquals(invalidResult.ok, true);
        if (invalidResult.ok) {
          assertEquals(invalidResult.data.shouldProcess, false);
        }
      }
    });

    it("should return error for invalid file data", () => {
      const schema = { properties: {} };
      const constraintsResult = SchemaConstraints.extract(schema);
      assertEquals(constraintsResult.ok, true);

      if (constraintsResult.ok) {
        const result = constraintsResult.data.shouldProcessFile("invalid");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidFormat");
        }
      }
    });

    it("should handle missing properties gracefully", () => {
      const schema = {
        properties: {
          id: {
            type: "object",
            properties: {
              level: { type: "string", const: "design" },
            },
          },
        },
      };

      const constraintsResult = SchemaConstraints.extract(schema);
      assertEquals(constraintsResult.ok, true);

      if (constraintsResult.ok) {
        // File data missing the constrained property
        const fileData = { someOtherProperty: "value" };
        const filterResult = constraintsResult.data.shouldProcessFile(fileData);
        assertEquals(filterResult.ok, true);
        if (filterResult.ok) {
          // Should not match since id.level is undefined and doesn't equal "design"
          assertEquals(filterResult.data.shouldProcess, false);
        }
      }
    });
  });
});
