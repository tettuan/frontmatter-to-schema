/**
 * Template Engine - Core template processing following requirements
 *
 * CRITICAL PRINCIPLES:
 * 1. Template defines COMPLETE output - only what's in template is output
 * 2. {variable.path} patterns are replaced with actual values
 * 3. NO schema structure inference or completion
 * 4. x-frontmatter-part arrays are populated from documents
 */

import { SchemaExtensionConfig } from "../domain/config/schema-extension-config.ts";
import { SchemaPropertyAccessor } from "../domain/schema/services/schema-property-accessor.ts";

export interface ProcessingContext {
  schemaData: Record<string, unknown>;
  documentData: Record<string, unknown>[];
  templateContent: string;
}

import type { ProcessingError, Result } from "../types.ts";

export class TemplateEngine {
  private readonly accessor: SchemaPropertyAccessor;

  private constructor(accessor: SchemaPropertyAccessor) {
    this.accessor = accessor;
  }

  static create(
    config?: SchemaExtensionConfig,
  ): Result<TemplateEngine, ProcessingError> {
    try {
      const extensionConfig = config || TemplateEngine.createDefaultConfig();
      if (!extensionConfig) {
        return {
          ok: false,
          error: {
            kind: "TemplateRenderFailed",
            template: "default-config",
            data: "Failed to create default schema extension configuration",
          },
        };
      }

      const accessor = new SchemaPropertyAccessor(extensionConfig);
      return { ok: true, data: new TemplateEngine(accessor) };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: "engine-creation",
          data: `TemplateEngine creation failed: ${error}`,
        },
      };
    }
  }

  private static createDefaultConfig(): SchemaExtensionConfig | null {
    const result = SchemaExtensionConfig.createDefault();
    if (!result.ok) {
      return null;
    }
    return result.data;
  }

  /**
   * Process template according to requirements
   */
  process(context: ProcessingContext): string {
    const { schemaData, documentData, templateContent } = context;

    // Parse template
    let templateObj: unknown;
    try {
      templateObj = JSON.parse(templateContent);
    } catch {
      // Not JSON - treat as plain text
      return this.processPlainTextTemplate(templateContent, documentData);
    }

    // Process JSON template
    let result = this.processJsonTemplate(
      templateObj,
      schemaData,
      documentData,
      schemaData, // Pass root schema for property resolution
    );

    // Second pass: process x-derived-from expressions that depend on processed data
    result = this.processSecondPassDerivations(
      result,
      schemaData,
      result,
      schemaData,
    );

    return JSON.stringify(result, null, 2);
  }

  private processSecondPassDerivations(
    result: unknown,
    schema: Record<string, unknown>,
    rootResult: unknown,
    rootSchema?: Record<string, unknown>,
  ): unknown {
    if (typeof result === "string") {
      // Check if this is a derivation placeholder variable
      const match = result.match(/^\{([^}]+)\}$/);
      if (match) {
        const varPath = match[1];
        const propertySchema = this.findSchemaProperty(
          rootSchema || schema,
          varPath,
        );
        const derivedFrom = propertySchema
          ? this.accessor.getDerivedFrom(propertySchema)
          : undefined;
        if (derivedFrom && propertySchema) {
          const isUnique = this.accessor.isDerivedUnique(propertySchema);

          // Extract from the processed result instead of raw documents
          const values = this.extractFromProcessedResult(
            derivedFrom,
            rootResult,
          );

          if (isUnique && Array.isArray(values)) {
            return [...new Set(values)];
          }
          return values;
        }
      }
      return result;
    }

    if (Array.isArray(result)) {
      return result.map((item) =>
        this.processSecondPassDerivations(item, schema, rootResult, rootSchema)
      );
    }

    if (typeof result === "object" && result !== null) {
      const processedResult: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(result)) {
        const keySchema = this.getSchemaForKey(schema, key);
        processedResult[key] = this.processSecondPassDerivations(
          value,
          keySchema || schema,
          rootResult,
          rootSchema,
        );
      }
      return processedResult;
    }

    return result;
  }

  private extractFromProcessedResult(
    derivedFromExpression: string,
    rootResult: unknown,
  ): unknown[] {
    // Parse expressions like "commands[].c1" to extract from processed result
    const match = derivedFromExpression.match(/^([^[]+)\[\]\.(.+)$/);
    if (!match) {
      return [];
    }

    const arrayPath = match[1];
    const itemPath = match[2];
    const values: unknown[] = [];

    // Navigate to the array in the processed result
    if (typeof rootResult === "object" && rootResult !== null) {
      const rootObj = rootResult as Record<string, unknown>;
      // For "commands[].c1", we need to look at tools.commands within the root result
      let searchPath = arrayPath;

      // If this is a relative path and we're in a tools context, prefix with tools
      if (arrayPath === "commands" && rootObj.tools) {
        searchPath = "tools.commands";
      }

      const arrayValue = this.getValueFromPath(rootObj, searchPath);

      if (Array.isArray(arrayValue)) {
        for (const item of arrayValue) {
          if (typeof item === "object" && item !== null) {
            const value = this.getValueFromPath(
              item as Record<string, unknown>,
              itemPath,
            );
            if (value !== undefined) {
              values.push(value);
            }
          }
        }
      }
    }

    return values;
  }

  private getValueFromPath(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (typeof current === "object" && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private processJsonTemplate(
    template: unknown,
    schema: Record<string, unknown>,
    documents: Record<string, unknown>[],
    rootSchema?: Record<string, unknown>,
  ): unknown {
    if (typeof template === "string") {
      // Check for variable pattern
      return this.substituteVariable(template, schema, documents, rootSchema);
    }

    if (Array.isArray(template)) {
      // Check if this is an x-frontmatter-part array
      // The array should be empty in template and filled from documents
      if (template.length === 0 && this.isArrayFrontmatterPart(schema)) {
        return this.processXFrontmatterPartArray(documents, schema);
      }
      // Regular array - process each element
      return template.map((item) =>
        this.processJsonTemplate(item, schema, documents, rootSchema)
      );
    }

    if (typeof template === "object" && template !== null) {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(template)) {
        // Check if this key is x-frontmatter-part in schema
        const keySchema = this.getSchemaForKey(schema, key);

        if (keySchema && this.accessor.hasFrontmatterPart(keySchema)) {
          // This is frontmatter-part - populate from documents
          result[key] = this.processXFrontmatterPartArray(documents, keySchema);
        } else {
          // Regular processing
          result[key] = this.processJsonTemplate(
            value,
            keySchema || {},
            documents,
            rootSchema,
          );
        }
      }

      return result;
    }

    return template;
  }

  private substituteVariable(
    template: string,
    schema: Record<string, unknown>,
    documents: Record<string, unknown>[],
    rootSchema?: Record<string, unknown>,
  ): unknown {
    // Check for {variable} pattern
    const match = template.match(/^\{([^}]+)\}$/);
    if (!match) {
      return template;
    }

    const varPath = match[1];

    // Check if this variable has x-derived-from in the schema
    // Use root schema for property resolution if available
    const derivedValue = this.getDerivedValue(
      rootSchema || schema,
      varPath,
      documents,
    );
    if (derivedValue !== undefined) {
      return derivedValue;
    }

    // Try to get value from schema defaults first
    const schemaValue = this.getSchemaDefault(schema, varPath);
    if (schemaValue !== undefined) {
      return schemaValue;
    }

    // Try to get aggregated value from documents
    const docValue = this.getAggregatedValue(documents, varPath);
    if (docValue !== undefined) {
      return docValue;
    }

    // Return template as-is if no value found
    return template;
  }

  private getSchemaForKey(
    schema: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | undefined {
    if (schema.properties && typeof schema.properties === "object") {
      const props = schema.properties as Record<string, unknown>;
      const prop = props[key];
      if (typeof prop === "object" && prop !== null) {
        return prop as Record<string, unknown>;
      }
    }
    return undefined;
  }

  private getSchemaDefault(
    schema: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = schema;

    for (const part of parts) {
      if (typeof current !== "object" || current === null) {
        return undefined;
      }

      const obj = current as Record<string, unknown>;

      // Check in properties first
      if (obj.properties && typeof obj.properties === "object") {
        const props = obj.properties as Record<string, unknown>;
        if (props[part] && typeof props[part] === "object") {
          const prop = props[part] as Record<string, unknown>;
          if (prop.default !== undefined) {
            return prop.default;
          }
          current = prop;
        } else {
          current = undefined;
        }
      } else {
        current = obj[part];
      }
    }

    return current;
  }

  private isArrayFrontmatterPart(schema: Record<string, unknown>): boolean {
    return this.accessor.hasFrontmatterPart(schema);
  }

  private collectFrontmatterValues(
    documents: Record<string, unknown>[],
    _schema: Record<string, unknown>,
  ): unknown[] {
    const values: unknown[] = [];

    // For x-frontmatter-part arrays, we collect entire document frontmatter objects
    // The template processing will handle individual field extraction
    for (const doc of documents) {
      // Push the entire frontmatter object for template processing
      values.push(doc);
    }

    return values;
  }

  private processXFrontmatterPartArray(
    documents: Record<string, unknown>[],
    schema: Record<string, unknown>,
  ): unknown[] {
    const results: unknown[] = [];

    // Get the item template from the schema
    const itemSchema = this.getItemSchema(schema);
    if (!itemSchema) {
      // No item schema - fallback to collecting raw frontmatter
      return this.collectFrontmatterValues(documents, schema);
    }

    // Process each document through its template
    for (const doc of documents) {
      // Create a single-document array for processing
      const processedItem = this.processDocumentWithTemplate(doc, itemSchema);
      if (processedItem !== undefined) {
        results.push(processedItem);
      }
    }

    return results;
  }

  private getItemSchema(
    schema: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (
      schema.items && typeof schema.items === "object" && schema.items !== null
    ) {
      return schema.items as Record<string, unknown>;
    }
    return undefined;
  }

  private processDocumentWithTemplate(
    document: Record<string, unknown>,
    itemSchema: Record<string, unknown>,
  ): unknown {
    // Check if item has its own template
    const templateName = itemSchema["x-template"] as string | undefined;
    if (!templateName) {
      // No template - return the document as-is
      return document;
    }

    // For now, process as simple field mapping since we don't have template loading
    // This needs to be enhanced to load and process the actual template file
    const result: Record<string, unknown> = {};

    // Get the item properties and map them from the document
    if (itemSchema.properties && typeof itemSchema.properties === "object") {
      const props = itemSchema.properties as Record<string, unknown>;
      for (const [key, _propSchema] of Object.entries(props)) {
        // Simple field mapping - get value from document
        const value = document[key];
        if (value !== undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  private getDerivedValue(
    schema: Record<string, unknown>,
    varPath: string,
    documents: Record<string, unknown>[],
  ): unknown {
    // Find the schema property for this variable path
    const propertySchema = this.findSchemaProperty(schema, varPath);
    if (!propertySchema) {
      return undefined;
    }

    // Use SchemaPropertyAccessor instead of direct property access
    const derivedFrom = this.accessor.getDerivedFrom(propertySchema);
    if (!derivedFrom) {
      return undefined;
    }

    // Parse the derived-from expression (e.g., "commands[].c1")
    const values = this.extractDerivedValues(documents, derivedFrom);

    // Check if unique deduplication is required
    if (this.accessor.isDerivedUnique(propertySchema)) {
      // Remove duplicates and return unique values
      return [...new Set(values)];
    }

    return values;
  }

  private findSchemaProperty(
    schema: Record<string, unknown>,
    varPath: string,
  ): Record<string, unknown> | undefined {
    // Navigate the schema to find the property for this variable path
    // For "tools.availableConfigs", we need to navigate to tools -> availableConfigs
    const parts = varPath.split(".");
    let current = schema;

    for (const part of parts) {
      if (!current.properties || typeof current.properties !== "object") {
        return undefined;
      }

      const props = current.properties as Record<string, unknown>;
      const prop = props[part];

      if (!prop || typeof prop !== "object" || prop === null) {
        return undefined;
      }

      current = prop as Record<string, unknown>;
    }

    return current;
  }

  private extractDerivedValues(
    documents: Record<string, unknown>[],
    expression: string,
  ): unknown[] {
    const values: unknown[] = [];

    // Parse expressions like "commands[].c1"
    // This is a simplified parser - could be enhanced for more complex expressions
    const match = expression.match(/^([^[]+)\[\]\.(.+)$/);
    if (!match) {
      // Not an array expression - try direct path
      for (const doc of documents) {
        const value = this.extractDocumentValue(doc, expression);
        if (value !== undefined) {
          values.push(value);
        }
      }
      return values;
    }

    const arrayPath = match[1];
    const itemPath = match[2];

    // Extract from each document
    for (const doc of documents) {
      const arrayValue = this.extractDocumentValue(doc, arrayPath);
      if (Array.isArray(arrayValue)) {
        for (const item of arrayValue) {
          if (typeof item === "object" && item !== null) {
            const value = this.extractDocumentValue(
              item as Record<string, unknown>,
              itemPath,
            );
            if (value !== undefined) {
              values.push(value);
            }
          }
        }
      }
    }

    return values;
  }

  private extractDocumentValue(
    doc: Record<string, unknown>,
    path: string,
  ): unknown {
    // Handle array notation like "traceability[0].id.full"
    const parts = path.split(".");
    let current: unknown = doc;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Check for array notation
      const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);

        if (typeof current === "object") {
          const obj = current as Record<string, unknown>;
          const arr = obj[key];
          if (Array.isArray(arr) && index < arr.length) {
            current = arr[index];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      } else {
        // Regular property access
        if (typeof current === "object") {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
    }

    return current;
  }

  private getAggregatedValue(
    documents: Record<string, unknown>[],
    path: string,
  ): unknown {
    // For simple aggregation, return first non-null value
    for (const doc of documents) {
      const value = this.extractDocumentValue(doc, path);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return undefined;
  }

  private processPlainTextTemplate(
    template: string,
    documents: Record<string, unknown>[],
  ): string {
    // For plain text templates like "{traceability[0].id.full}"
    const match = template.match(/^\{([^}]+)\}$/);
    if (!match) {
      return template;
    }

    const varPath = match[1];
    const values: unknown[] = [];

    for (const doc of documents) {
      const value = this.extractDocumentValue(doc, varPath);
      if (value !== undefined) {
        values.push(value);
      }
    }

    // Return as JSON array
    return JSON.stringify(values, null, 2);
  }
}
