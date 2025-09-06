/**
 * Template Value Objects - Following Totality and DDD Principles
 *
 * Implements smart constructors and discriminated unions to ensure
 * type safety and eliminate partial functions.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Template Content Value Object - Ensures valid template content
 */
export class TemplateContent {
  private constructor(
    private readonly value: string,
    private readonly metadata: TemplateMetadata,
  ) {}

  /**
   * Smart constructor for TemplateContent
   */
  static create(
    content: unknown,
  ): Result<TemplateContent, DomainError & { message: string }> {
    if (typeof content !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(content),
          expectedFormat: "string",
        }, "Template content must be a string"),
      };
    }

    if (content.trim().length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "template content",
        }, "Template content cannot be empty"),
      };
    }

    const metadata = TemplateContent.analyzeMetadata(content);
    return {
      ok: true,
      data: new TemplateContent(content, metadata),
    };
  }

  private static analyzeMetadata(content: string): TemplateMetadata {
    const placeholders = TemplateContent.extractPlaceholders(content);
    return {
      placeholderCount: placeholders.length,
      placeholders,
      hasConditionals: content.includes("{{#") || content.includes("{{^"),
      hasIterations: content.includes("{{#each") || content.includes("{{#for"),
    };
  }

  private static extractPlaceholders(content: string): string[] {
    const patterns = [
      /\{\{([^}]+)\}\}/g, // Mustache style
      /\$\{([^}]+)\}/g, // Dollar style
      /%\{([^}]+)\}%/g, // Percent style
    ];

    const placeholders = new Set<string>();
    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          placeholders.add(match[1].trim());
        }
      }
    }
    return Array.from(placeholders);
  }

  getValue(): string {
    return this.value;
  }

  getMetadata(): TemplateMetadata {
    return this.metadata;
  }

  getPlaceholders(): string[] {
    return this.metadata.placeholders;
  }
}

/**
 * Template Metadata
 */
export interface TemplateMetadata {
  readonly placeholderCount: number;
  readonly placeholders: string[];
  readonly hasConditionals: boolean;
  readonly hasIterations: boolean;
}

/**
 * Template Type - Discriminated Union (Totality Pattern)
 */
export type TemplateType =
  | { kind: "Simple"; content: TemplateContent }
  | { kind: "Schema"; content: TemplateContent; schema: TemplateSchema }
  | { kind: "Structured"; structure: TemplateStructure }
  | { kind: "Composite"; templates: TemplateType[] };

/**
 * Template Schema Value Object
 */
export class TemplateSchema {
  private constructor(
    private readonly properties: Map<string, PropertyDefinition>,
    private readonly required: Set<string>,
  ) {}

  /**
   * Smart constructor for TemplateSchema
   */
  static create(
    schema: unknown,
  ): Result<TemplateSchema, DomainError & { message: string }> {
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(schema),
          expectedFormat: "object",
        }, "Schema must be an object"),
      };
    }

    const schemaObj = schema as Record<string, unknown>;

    if (!schemaObj.properties || typeof schemaObj.properties !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "schema",
          expectedFormat: "object with properties",
        }, "Schema must have properties object"),
      };
    }

    const properties = new Map<string, PropertyDefinition>();
    for (const [key, value] of Object.entries(schemaObj.properties)) {
      const propDef = TemplateSchema.parsePropertyDefinition(key, value);
      properties.set(key, propDef);
    }

    const required = new Set<string>(
      Array.isArray(schemaObj.required) ? schemaObj.required : [],
    );

    return {
      ok: true,
      data: new TemplateSchema(properties, required),
    };
  }

  private static parsePropertyDefinition(
    key: string,
    value: unknown,
  ): PropertyDefinition {
    if (!value || typeof value !== "object") {
      return { name: key, type: "unknown", optional: true };
    }

    const prop = value as Record<string, unknown>;
    return {
      name: key,
      type: (prop.type as string) || "unknown",
      optional: !prop.required,
      description: prop.description as string | undefined,
    };
  }

  getProperties(): Map<string, PropertyDefinition> {
    return new Map(this.properties);
  }

  getRequired(): Set<string> {
    return new Set(this.required);
  }

  isRequired(property: string): boolean {
    return this.required.has(property);
  }
}

/**
 * Property Definition
 */
export interface PropertyDefinition {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
  readonly description?: string;
}

/**
 * Template Structure for complex templates
 */
export class TemplateStructure {
  private constructor(
    private readonly sections: Map<string, TemplateSection>,
  ) {}

  /**
   * Smart constructor for TemplateStructure
   */
  static create(
    structure: unknown,
  ): Result<TemplateStructure, DomainError & { message: string }> {
    if (!structure || typeof structure !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(structure),
          expectedFormat: "object",
        }, "Structure must be an object"),
      };
    }

    const sections = new Map<string, TemplateSection>();
    for (const [key, value] of Object.entries(structure)) {
      const sectionResult = TemplateStructure.parseSection(key, value);
      if (!sectionResult.ok) {
        return sectionResult;
      }
      sections.set(key, sectionResult.data);
    }

    return {
      ok: true,
      data: new TemplateStructure(sections),
    };
  }

  private static parseSection(
    name: string,
    value: unknown,
  ): Result<TemplateSection, DomainError & { message: string }> {
    if (typeof value === "string") {
      return {
        ok: true,
        data: { kind: "Static", name, content: value },
      };
    }

    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.template) {
        return {
          ok: true,
          data: { kind: "Dynamic", name, template: String(obj.template) },
        };
      }
      if (obj.repeat) {
        return {
          ok: true,
          data: {
            kind: "Repeating",
            name,
            itemTemplate: String(obj.itemTemplate || ""),
            separator: String(obj.separator || ""),
          },
        };
      }
    }

    return {
      ok: false,
      error: createDomainError({
        kind: "InvalidFormat",
        input: String(value),
        expectedFormat: "string or template object",
      }, `Invalid section: ${name}`),
    };
  }

  getSections(): Map<string, TemplateSection> {
    return new Map(this.sections);
  }
}

/**
 * Template Section - Discriminated Union
 */
export type TemplateSection =
  | { kind: "Static"; name: string; content: string }
  | { kind: "Dynamic"; name: string; template: string }
  | {
    kind: "Repeating";
    name: string;
    itemTemplate: string;
    separator: string;
  };

/**
 * Template Processing Mode - Constrained Value Type
 */
export type ProcessingMode = "Strict" | "Lenient" | "Fallback";

/**
 * Template Variable Value - Discriminated Union for type safety
 */
export type TemplateVariable =
  | { kind: "String"; value: string }
  | { kind: "Number"; value: number }
  | { kind: "Boolean"; value: boolean }
  | { kind: "Array"; items: TemplateVariable[] }
  | { kind: "Object"; properties: Map<string, TemplateVariable> }
  | { kind: "Null" }
  | { kind: "Undefined" };
