/**
 * SchemaManager - Canonical schema management service
 * 
 * Consolidates all schema operations into a single service
 * following the Single Path Principle (Issue #691)
 * 
 * Replaces:
 * - schema-loading.service.ts
 * - schema-loader.service.ts
 * - schema-configuration.service.ts
 * - field-validation.service.ts
 * - type-validation.service.ts
 * - schema-property-extractor.service.ts
 * - schema-analyzer.service.ts
 * - schema-processor.service.ts
 */

import { Result } from "../../domain/core/result.ts";
import { createDomainError, DomainError } from "../../domain/core/result.ts";
import { SchemaDefinition } from "../../domain/value-objects/schema-definition.ts";
import { SchemaPath } from "../../domain/value-objects/schema-path.ts";
import { FileSystemRepository } from "../../infrastructure/adapters/deno-file-system-repository.ts";
import { parseSchema } from "../../domain/models/schema.ts";
import { SchemaExtensions } from "../../domain/models/schema-extensions.ts";
import { SchemaValidator } from "../../domain/services/schema-validator.ts";
import { RefResolver } from "../../domain/schema/services/ref-resolver.ts";

export interface SchemaWithExtensions {
  schema: SchemaDefinition;
  extensions: SchemaExtensions;
}

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  format?: string;
  enum?: string[];
  default?: unknown;
  extensions?: Record<string, unknown>;
}

/**
 * SchemaManager - Consolidated schema management
 */
export class SchemaManager {
  private readonly fileSystemRepository: FileSystemRepository;
  private readonly schemaValidator: SchemaValidator;
  private readonly refResolver: RefResolver;
  private schemaCache: Map<string, SchemaWithExtensions> = new Map();

  constructor() {
    this.fileSystemRepository = new FileSystemRepository();
    this.schemaValidator = new SchemaValidator();
    this.refResolver = new RefResolver();
  }

  /**
   * Loads and validates a schema from file
   */
  async loadSchema(
    path: string,
    format?: "json" | "yaml"
  ): Promise<Result<SchemaWithExtensions, DomainError>> {
    // Check cache first
    if (this.schemaCache.has(path)) {
      return { ok: true, data: this.schemaCache.get(path)! };
    }

    // Validate path
    const pathResult = SchemaPath.create(path);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          `Invalid schema path: ${pathResult.error.message}`,
          { path }
        ),
      };
    }

    // Read schema file
    const readResult = await this.fileSystemRepository.readFile(path);
    if (!readResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          "io",
          `Failed to read schema file: ${readResult.error.message}`,
          { path }
        ),
      };
    }

    // Parse schema
    const parseResult = parseSchema(readResult.data, format || "json");
    if (!parseResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          "parsing",
          `Failed to parse schema: ${parseResult.error.message}`,
          { path, content: readResult.data }
        ),
      };
    }

    // Create schema definition
    const definitionResult = SchemaDefinition.create(parseResult.data);
    if (!definitionResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          `Invalid schema definition: ${definitionResult.error.message}`,
          { path, schema: parseResult.data }
        ),
      };
    }

    // Extract extensions
    const extensions = SchemaExtensions.fromSchema(parseResult.data);

    // Resolve references if needed
    if (this.hasReferences(parseResult.data)) {
      const resolveResult = await this.refResolver.resolveRefs(
        parseResult.data,
        path
      );
      if (!resolveResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            "resolution",
            `Failed to resolve schema references: ${resolveResult.error.message}`,
            { path }
          ),
        };
      }
    }

    const result: SchemaWithExtensions = {
      schema: definitionResult.data,
      extensions,
    };

    // Cache the result
    this.schemaCache.set(path, result);

    return { ok: true, data: result };
  }

  /**
   * Validates data against a schema
   */
  validateData(
    data: unknown,
    schema: SchemaDefinition
  ): Result<unknown, DomainError> {
    const validationResult = this.schemaValidator.validate(data, schema.getValue());
    if (!validationResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          `Schema validation failed: ${validationResult.error.message}`,
          { data, schema: schema.getValue() }
        ),
      };
    }

    return { ok: true, data };
  }

  /**
   * Extracts properties from a schema
   */
  extractProperties(schema: SchemaDefinition): SchemaProperty[] {
    const properties: SchemaProperty[] = [];
    const schemaObj = schema.getValue();

    if (schemaObj.properties) {
      const required = schemaObj.required || [];
      
      for (const [name, prop] of Object.entries(schemaObj.properties)) {
        const property: SchemaProperty = {
          name,
          type: this.extractType(prop),
          required: required.includes(name),
          description: prop.description,
          format: prop.format,
          enum: prop.enum,
          default: prop.default,
        };

        // Extract x-extensions
        const extensions: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(prop)) {
          if (key.startsWith("x-")) {
            extensions[key] = value;
          }
        }
        if (Object.keys(extensions).length > 0) {
          property.extensions = extensions;
        }

        properties.push(property);
      }
    }

    return properties;
  }

  /**
   * Validates field type
   */
  validateFieldType(
    value: unknown,
    expectedType: string
  ): Result<unknown, DomainError> {
    const actualType = typeof value;

    // Handle array type
    if (expectedType === "array") {
      if (!Array.isArray(value)) {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            `Expected array but got ${actualType}`,
            { value, expectedType }
          ),
        };
      }
      return { ok: true, data: value };
    }

    // Handle object type
    if (expectedType === "object") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            `Expected object but got ${actualType}`,
            { value, expectedType }
          ),
        };
      }
      return { ok: true, data: value };
    }

    // Handle primitive types
    if (actualType !== expectedType) {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          `Expected ${expectedType} but got ${actualType}`,
          { value, expectedType }
        ),
      };
    }

    return { ok: true, data: value };
  }

  /**
   * Analyzes schema for aggregation capabilities
   */
  analyzeForAggregation(schema: SchemaDefinition): {
    hasArrayProperties: boolean;
    arrayProperties: string[];
    hasDerivedProperties: boolean;
    derivedProperties: string[];
  } {
    const properties = this.extractProperties(schema);
    const arrayProperties: string[] = [];
    const derivedProperties: string[] = [];

    for (const prop of properties) {
      if (prop.type === "array") {
        arrayProperties.push(prop.name);
      }
      if (prop.extensions?.["x-derived-from"]) {
        derivedProperties.push(prop.name);
      }
    }

    return {
      hasArrayProperties: arrayProperties.length > 0,
      arrayProperties,
      hasDerivedProperties: derivedProperties.length > 0,
      derivedProperties,
    };
  }

  /**
   * Helper: Checks if schema has references
   */
  private hasReferences(schema: unknown): boolean {
    if (typeof schema !== "object" || schema === null) {
      return false;
    }

    const stack = [schema];
    while (stack.length > 0) {
      const current = stack.pop();
      if (typeof current === "object" && current !== null) {
        for (const [key, value] of Object.entries(current)) {
          if (key === "$ref") {
            return true;
          }
          if (typeof value === "object" && value !== null) {
            stack.push(value);
          }
        }
      }
    }

    return false;
  }

  /**
   * Helper: Extracts type from schema property
   */
  private extractType(prop: any): string {
    if (prop.type) {
      return prop.type;
    }
    if (prop.$ref) {
      return "reference";
    }
    if (prop.oneOf || prop.anyOf || prop.allOf) {
      return "union";
    }
    return "unknown";
  }

  /**
   * Clears the schema cache
   */
  clearCache(): void {
    this.schemaCache.clear();
  }
}