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

import type { Result, ValidationError } from "../shared/types.ts";

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
   * Analyzes YAML object structure recursively
   */
  static analyzeYAMLStructure(
    yamlData: unknown,
    basePath = "",
  ): Result<StructureNode, ValidationError> {
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
            error: {
              kind: "ValidationError",
              message:
                `Array elements have inconsistent structures at ${basePath}[${i}]`,
            },
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

      for (
        const [key, value] of Object.entries(
          yamlData as Record<string, unknown>,
        )
      ) {
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
  ): Result<StructureNode, ValidationError> {
    if (typeof schemaData !== "object" || schemaData === null) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Schema must be an object",
        },
      };
    }

    const schema = schemaData as Record<string, unknown>;

    // Handle schema type
    const schemaType = schema.type as string;

    if (schemaType === "object") {
      const properties = schema.properties as
        | Record<string, unknown>
        | undefined;

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
      const items = schema.items as Record<string, unknown> | undefined;

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
      error: {
        kind: "ValidationError",
        message: `Unsupported schema type: ${schemaType}`,
      },
    };
  }

  /**
   * Analyzes template structure from mapping rules
   */
  static analyzeTemplateStructure(
    templateData: unknown,
    basePath = "",
  ): Result<StructureNode, ValidationError> {
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
  ): Result<boolean, ValidationError> {
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
        error: {
          kind: "ValidationError",
          message: "YAML structure does not match Schema structure",
        },
      };
    }

    const schemaTemplateMatch = this.structuresEqual(
      schemaResult.data,
      templateResult.data,
    );
    if (!schemaTemplateMatch) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Schema structure does not match Template structure",
        },
      };
    }

    return { ok: true, data: true };
  }
}
