/**
 * Strict Structure Matcher for YAML-Schema-Template alignment
 *
 * Enforces exact structural matching between:
 * - YAML frontmatter hierarchy
 * - Schema definition structure
 * - Template mapping structure
 *
 * No approximate matching or fallback logic is allowed.
 * Only perfect structural alignment enables template processing.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

export interface StructureNode {
  readonly path: string;
  readonly type: "object" | "array" | "string" | "number" | "boolean" | "null";
  readonly children?: Map<string, StructureNode>;
  readonly arrayElementType?: StructureNode;
}

/**
 * Analyzes and compares hierarchical structures for exact matching
 */
export class StrictStructureMatcher {
  /**
   * Type guard for Record<string, unknown>
   */
  private static isRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  /**
   * Analyzes YAML object structure recursively
   */
  static analyzeYAMLStructure(
    yamlData: unknown,
    basePath = "",
  ): Result<StructureNode, DomainError & { message: string }> {
    if (yamlData === null || yamlData === undefined) {
      return {
        ok: true,
        data: {
          path: basePath,
          type: "null",
        },
      };
    }

    if (Array.isArray(yamlData)) {
      if (yamlData.length === 0) {
        return {
          ok: true,
          data: {
            path: basePath,
            type: "array",
            arrayElementType: { path: `${basePath}[]`, type: "null" },
          },
        };
      }

      // Analyze first element to determine array element type
      const firstElementResult = this.analyzeYAMLStructure(
        yamlData[0],
        `${basePath}[]`,
      );
      if (!firstElementResult.ok) {
        return firstElementResult;
      }

      // Verify all elements have the same structure
      for (let i = 1; i < yamlData.length; i++) {
        const elementResult = this.analyzeYAMLStructure(
          yamlData[i],
          `${basePath}[]`,
        );
        if (!elementResult.ok) {
          return elementResult;
        }

        if (
          !this.structuresEqual(firstElementResult.data, elementResult.data)
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: `${basePath}[${i}]`,
                expectedFormat: "consistent array element structure",
              },
              `Array elements have inconsistent structures at ${basePath}[${i}]`,
            ),
          };
        }
      }

      return {
        ok: true,
        data: {
          path: basePath,
          type: "array",
          arrayElementType: firstElementResult.data,
        },
      };
    }

    if (typeof yamlData === "object" && yamlData !== null) {
      const children = new Map<string, StructureNode>();

      // We validated yamlData is an object above
      if (!this.isRecordObject(yamlData)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: typeof yamlData,
            expectedFormat: "object",
          }, "YAML data must be an object"),
        };
      }

      for (const [key, value] of Object.entries(yamlData)) {
        const childPath = basePath ? `${basePath}.${key}` : key;
        const childResult = this.analyzeYAMLStructure(value, childPath);

        if (!childResult.ok) {
          return childResult;
        }

        children.set(key, childResult.data);
      }

      return {
        ok: true,
        data: {
          path: basePath,
          type: "object",
          children,
        },
      };
    }

    // Primitive types
    const type = typeof yamlData as "string" | "number" | "boolean";
    return {
      ok: true,
      data: {
        path: basePath,
        type,
      },
    };
  }

  /**
   * Analyzes JSON Schema structure
   */
  static analyzeSchemaStructure(
    schemaData: unknown,
    basePath = "",
  ): Result<StructureNode, DomainError & { message: string }> {
    if (typeof schemaData !== "object" || schemaData === null) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof schemaData,
          expectedFormat: "object",
        }, "Schema must be an object"),
      };
    }

    // We validated schemaData is an object above
    if (!this.isRecordObject(schemaData)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof schemaData,
          expectedFormat: "object",
        }, "Schema must be an object"),
      };
    }
    const schema = schemaData;

    // Handle schema type with safe extraction
    const schemaTypeValue = schema.type;
    const schemaType = typeof schemaTypeValue === "string" ? schemaTypeValue : "unknown";

    if (schemaType === "object") {
      const propertiesValue = schema.properties;
      const properties = this.isRecordObject(propertiesValue) ? propertiesValue : undefined;

      if (!properties || typeof properties !== "object") {
        return {
          ok: true,
          data: {
            path: basePath,
            type: "object",
            children: new Map(),
          },
        };
      }

      const children = new Map<string, StructureNode>();

      for (const [key, value] of Object.entries(properties)) {
        const childPath = basePath ? `${basePath}.${key}` : key;
        const childResult = this.analyzeSchemaStructure(value, childPath);

        if (!childResult.ok) {
          return childResult;
        }

        children.set(key, childResult.data);
      }

      return {
        ok: true,
        data: {
          path: basePath,
          type: "object",
          children,
        },
      };
    }

    if (schemaType === "array") {
      const itemsValue = schema.items;
      const items = this.isRecordObject(itemsValue) ? itemsValue : undefined;

      if (!items) {
        return {
          ok: true,
          data: {
            path: basePath,
            type: "array",
            arrayElementType: { path: `${basePath}[]`, type: "null" },
          },
        };
      }

      const elementResult = this.analyzeSchemaStructure(items, `${basePath}[]`);
      if (!elementResult.ok) {
        return elementResult;
      }

      return {
        ok: true,
        data: {
          path: basePath,
          type: "array",
          arrayElementType: elementResult.data,
        },
      };
    }

    // Primitive schema types
    if (["string", "number", "boolean", "null"].includes(schemaType)) {
      return {
        ok: true,
        data: {
          path: basePath,
          type: schemaType as "string" | "number" | "boolean" | "null",
        },
      };
    }

    return {
      ok: false,
      error: createDomainError({
        kind: "InvalidFormat",
        input: schemaType,
        expectedFormat: "string, number, boolean, null, object, or array",
      }, `Unsupported schema type: ${schemaType}`),
    };
  }

  /**
   * Analyzes template structure from mapping rules
   */
  static analyzeTemplateStructure(
    templateData: unknown,
    basePath = "",
  ): Result<StructureNode, DomainError & { message: string }> {
    return this.analyzeYAMLStructure(templateData, basePath);
  }

  /**
   * Compares two structure nodes for exact equality
   */
  static structuresEqual(node1: StructureNode, node2: StructureNode): boolean {
    if (node1.type !== node2.type) {
      return false;
    }

    if (node1.type === "object") {
      const children1 = node1.children || new Map();
      const children2 = node2.children || new Map();

      if (children1.size !== children2.size) {
        return false;
      }

      for (const [key, child1] of children1) {
        const child2 = children2.get(key);
        if (!child2 || !this.structuresEqual(child1, child2)) {
          return false;
        }
      }
    }

    if (node1.type === "array") {
      if (!node1.arrayElementType || !node2.arrayElementType) {
        return node1.arrayElementType === node2.arrayElementType;
      }
      return this.structuresEqual(
        node1.arrayElementType,
        node2.arrayElementType,
      );
    }

    return true;
  }

  /**
   * Validates exact structural match between YAML, Schema, and Template
   */
  static validateStructuralAlignment(
    yamlData: unknown,
    schemaData: unknown,
    templateData: unknown,
  ): Result<boolean, DomainError & { message: string }> {
    // Analyze each structure
    const yamlResult = this.analyzeYAMLStructure(yamlData);
    if (!yamlResult.ok) {
      return yamlResult;
    }

    const schemaResult = this.analyzeSchemaStructure(schemaData);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const templateResult = this.analyzeTemplateStructure(templateData);
    if (!templateResult.ok) {
      return templateResult;
    }

    // Compare structures for exact match
    const yamlSchemaMatch = this.structuresEqual(
      yamlResult.data,
      schemaResult.data,
    );
    if (!yamlSchemaMatch) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: schemaResult.data,
          data: yamlResult.data,
        }, "YAML structure does not match Schema structure"),
      };
    }

    const schemaTemplateMatch = this.structuresEqual(
      schemaResult.data,
      templateResult.data,
    );
    if (!schemaTemplateMatch) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: templateResult.data,
          source: schemaResult.data,
        }, "Schema structure does not match Template structure"),
      };
    }

    return { ok: true, data: true };
  }
}
