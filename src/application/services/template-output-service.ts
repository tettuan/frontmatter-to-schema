/**
 * Template Output Service - Handles template-based output generation
 * Following requirements from docs/requirements.ja.md
 */

import type { Result } from "../../domain/core/result.ts";
import { TemplateProcessor } from "../../domain/template/template-processor.ts";
import type { FileSystemPort } from "../../infrastructure/ports/index.ts";
import { SchemaExtensionConfig } from "../../domain/config/schema-extension-config.ts";
import { SchemaPropertyAccessor } from "../../domain/schema/services/schema-property-accessor.ts";

export interface OutputContext {
  schemaData: Record<string, unknown>;
  templateContent: string;
  documentData: Record<string, unknown>[];
  outputPath: string;
}

export class TemplateOutputService {
  private templateProcessor: TemplateProcessor;
  private accessor: SchemaPropertyAccessor;

  private constructor(
    private fileSystem: FileSystemPort,
    accessor: SchemaPropertyAccessor,
  ) {
    this.templateProcessor = new TemplateProcessor();
    this.accessor = accessor;
  }

  static create(
    fileSystem: FileSystemPort,
  ): Result<TemplateOutputService, { kind: string; message: string }> {
    const configResult = SchemaExtensionConfig.createDefault();
    if (!configResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigurationError",
          message: `Configuration error: ${configResult.error.message}`,
        },
      };
    }

    const accessor = new SchemaPropertyAccessor(configResult.data);
    return {
      ok: true,
      data: new TemplateOutputService(fileSystem, accessor),
    };
  }

  /**
   * Generate output using template
   * Template completely defines output format
   */
  async generateOutput(
    context: OutputContext,
  ): Promise<Result<void, { kind: string; message: string }>> {
    try {
      const { schemaData, templateContent, documentData, outputPath } = context;

      // Find x-frontmatter-part fields and their templates
      const frontmatterParts = this.findFrontmatterParts(schemaData);

      let processedOutput: string;

      // Check if schema has any special processing fields (x-frontmatter-part or x-derived-from)
      const hasSpecialFields = frontmatterParts.length > 0 ||
        this.hasSchemaSpecialFields(schemaData);

      if (hasSpecialFields) {
        // Build data structure based on schema
        const outputData: Record<string, unknown> = {};

        // Process schema properties recursively to handle nested structures
        this.processSchemaProperties(
          schemaData,
          outputData,
          documentData,
          templateContent,
        );

        // IMPORTANT: Also include all frontmatter fields from the first document
        // so that basic {variable} replacements work
        if (documentData.length > 0) {
          const firstDoc = documentData[0];
          for (const [key, value] of Object.entries(firstDoc)) {
            // Only add if not already set by processSchemaProperties
            if (outputData[key] === undefined) {
              outputData[key] = value;
            }
          }
        }

        // Also add traditional template variables for backward compatibility
        outputData.count = documentData.length;
        outputData.documents = documentData;

        // Process template with the structured data
        const processingContext = {
          data: outputData,
        };

        const result = this.templateProcessor.process(
          templateContent,
          processingContext,
        );
        if (!result.ok) {
          return result;
        }
        processedOutput = result.data;
      } else {
        // Process as single aggregated data
        const aggregated = this.aggregateData(documentData, schemaData);
        const processingContext = {
          data: aggregated,
        };

        const result = this.templateProcessor.process(
          templateContent,
          processingContext,
        );
        if (!result.ok) {
          return result;
        }
        processedOutput = result.data;
      }

      // Write output file
      const writeResult = await this.fileSystem.writeFile(
        outputPath,
        processedOutput,
      );

      if (!writeResult.ok) {
        return {
          ok: false,
          error: {
            kind: "FileWriteError",
            message: `Failed to write output file: ${writeResult.error}`,
          },
        };
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "OutputGenerationError",
          message: `Failed to generate output: ${String(error)}`,
        },
      };
    }
  }

  private hasSchemaSpecialFields(schema: Record<string, unknown>): boolean {
    if (schema.properties && typeof schema.properties === "object") {
      return this.checkForSpecialFields(
        schema.properties as Record<string, unknown>,
      );
    }
    return false;
  }

  private checkForSpecialFields(obj: Record<string, unknown>): boolean {
    for (const [_key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        const def = value as Record<string, unknown>;
        if (this.accessor.hasFrontmatterPart(def) || this.accessor.getDerivedFrom(def)) {
          return true;
        }
        if (def.properties && typeof def.properties === "object") {
          if (
            this.checkForSpecialFields(
              def.properties as Record<string, unknown>,
            )
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private findFrontmatterParts(
    schema: Record<string, unknown>,
  ): Array<{ key: string; definition: Record<string, unknown> }> {
    const parts: Array<{ key: string; definition: Record<string, unknown> }> =
      [];

    if (schema.properties && typeof schema.properties === "object") {
      const props = schema.properties as Record<string, unknown>;

      for (const [key, value] of Object.entries(props)) {
        if (typeof value === "object" && value !== null) {
          const def = value as Record<string, unknown>;
          if (this.accessor.hasFrontmatterPart(def)) {
            parts.push({ key, definition: def });
          }
        }
      }
    }

    return parts;
  }

  private extractArrayValues(
    documents: Record<string, unknown>[],
    templatePattern: string,
  ): unknown[] {
    const values: unknown[] = [];

    // Parse template to find variable pattern
    const match = templatePattern.match(/\{([^}]+)\}/);
    if (!match) {
      return values;
    }

    const varPath = match[1];

    // Extract value from each document
    for (const doc of documents) {
      const value = this.getValueByPath(doc, varPath);
      if (value !== undefined) {
        values.push(value);
      }
    }

    return values;
  }

  private aggregateData(
    documents: Record<string, unknown>[],
    schema: Record<string, unknown>,
  ): Record<string, unknown> {
    // Simple aggregation - collect all values
    const result: Record<string, unknown> = {};

    // Process x-derived-from fields
    this.processDerivations(result, documents, schema);

    // For simple schemas without special fields, provide direct access to frontmatter fields
    if (documents.length === 1) {
      // Single document case - merge frontmatter fields directly
      const document = documents[0];
      for (const [key, value] of Object.entries(document)) {
        if (result[key] === undefined) {
          result[key] = value;
        }
      }
    }

    // Add traditional template variables for backward compatibility
    result.count = documents.length;
    result.documents = documents;

    return result;
  }

  private processDerivations(
    result: Record<string, unknown>,
    documents: Record<string, unknown>[],
    schema: Record<string, unknown>,
  ): void {
    for (const [key, definition] of Object.entries(schema)) {
      if (typeof definition === "object" && definition !== null) {
        const def = definition as Record<string, unknown>;

        const derivedFrom = this.accessor.getDerivedFrom(def);
        if (derivedFrom) {
          const values = this.collectValues(documents, derivedFrom);

          if (this.accessor.isDerivedUnique(def)) {
            result[key] = [...new Set(values)];
          } else {
            result[key] = values;
          }
        }
      }
    }
  }

  private collectValues(
    documents: Record<string, unknown>[],
    path: string,
  ): unknown[] {
    const values: unknown[] = [];

    for (const doc of documents) {
      const value = this.getValueByPath(doc, path);
      if (value !== undefined) {
        if (Array.isArray(value)) {
          values.push(...value);
        } else {
          values.push(value);
        }
      }
    }

    return values;
  }

  private processSchemaProperties(
    schema: Record<string, unknown>,
    outputData: Record<string, unknown>,
    documentData: Record<string, unknown>[],
    templateContent: string,
    pathPrefix = "",
  ): void {
    if (!schema.properties || typeof schema.properties !== "object") {
      return;
    }

    const props = schema.properties as Record<string, unknown>;

    for (const [key, propDef] of Object.entries(props)) {
      if (typeof propDef === "object" && propDef !== null) {
        const def = propDef as Record<string, unknown>;
        const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

        // Handle frontmatter-part arrays using accessor
        if (this.accessor.hasFrontmatterPart(def)) {
          this.setNestedProperty(
            outputData,
            currentPath,
            this.extractArrayValues(
              documentData,
              templateContent,
            ),
          );
        } else {
          const derivedFrom = this.accessor.getDerivedFrom(def);
          if (derivedFrom) {
            // Process derivation
            const values = this.collectValues(documentData, derivedFrom);
            const result = this.accessor.isDerivedUnique(def)
              ? [...new Set(values)]
              : values;
            this.setNestedProperty(outputData, currentPath, result);
          } else if (def.default !== undefined) {
            // Use default value
            this.setNestedProperty(outputData, currentPath, def.default);
          } else if (def.properties) {
            // Recursively process nested object properties
            this.processSchemaProperties(
              def,
              outputData,
              documentData,
              templateContent,
              currentPath,
            );
          }
        }
      }
    }
  }

  private setNestedProperty(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent of the final property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        !(part in current) || typeof current[part] !== "object" ||
        current[part] === null
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final property
    const finalPart = parts[parts.length - 1];
    current[finalPart] = value;
  }

  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    // Handle array notation like "commands[].c1"
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (part.endsWith("[]")) {
        const arrayKey = part.slice(0, -2);
        if (typeof current === "object" && current !== null) {
          const arr = (current as Record<string, unknown>)[arrayKey];
          if (Array.isArray(arr)) {
            // Collect from array elements
            const results: unknown[] = [];
            for (const item of arr) {
              // Continue with remaining path
              const remainingPath = parts.slice(parts.indexOf(part) + 1).join(
                ".",
              );
              if (remainingPath) {
                const value = this.getValueByPath(
                  item as Record<string, unknown>,
                  remainingPath,
                );
                if (value !== undefined) {
                  results.push(value);
                }
              }
            }
            return results;
          }
        }
        return undefined;
      } else {
        if (typeof current !== "object" || current === null) {
          return undefined;
        }
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }
}
