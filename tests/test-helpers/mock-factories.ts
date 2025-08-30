/**
 * Factory functions for creating mock objects in tests
 */

import {
  Document,
  Schema,
  SchemaId,
  Template,
  TemplateId,
} from "../../src/domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
} from "../../src/domain/models/value-objects.ts";

/**
 * Creates a mock Document for testing
 */
export function createMockDocument(options: {
  path: string;
  content?: string;
}): Document {
  const documentPath = DocumentPath.create(options.path);
  if (!documentPath.ok) {
    throw new Error(
      `Failed to create mock document path: ${
        JSON.stringify(documentPath.error)
      }`,
    );
  }

  const content = options.content ||
    `# Mock Document\n\nContent for ${options.path}`;
  const documentContent = DocumentContent.create(content);
  if (!documentContent.ok) {
    throw new Error(
      `Failed to create mock document content: ${
        JSON.stringify(documentContent.error)
      }`,
    );
  }

  return Document.create(
    documentPath.data,
    { kind: "NoFrontMatter" },
    documentContent.data,
  );
}

/**
 * Creates a mock Schema for testing
 */
export function createMockSchema(name: string): Schema {
  const schemaId = SchemaId.create(name);
  if (!schemaId.ok) {
    throw new Error(
      `Failed to create mock schema ID: ${JSON.stringify(schemaId.error)}`,
    );
  }

  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      c1: { type: "string" },
      c2: { type: "string" },
      c3: { type: "string" },
    },
    required: ["c1", "c2", "c3"],
  });
  if (!definition.ok) {
    throw new Error(
      `Failed to create mock schema definition: ${
        JSON.stringify(definition.error)
      }`,
    );
  }

  const version = SchemaVersion.create("1.0.0");
  if (!version.ok) {
    throw new Error(
      `Failed to create mock schema version: ${JSON.stringify(version.error)}`,
    );
  }

  return Schema.create(
    schemaId.data,
    definition.data,
    version.data,
    `Mock schema for ${name}`,
  );
}

/**
 * Creates a mock Template for testing
 */
export function createMockTemplate(name: string): Template {
  const templateId = TemplateId.create(name);
  if (!templateId.ok) {
    throw new Error(
      `Failed to create mock template ID: ${JSON.stringify(templateId.error)}`,
    );
  }

  const format = TemplateFormat.create(
    "json",
    `Mock template for ${name}: {c1}-{c2}-{c3}`,
  );
  if (!format.ok) {
    throw new Error(
      `Failed to create mock template format: ${JSON.stringify(format.error)}`,
    );
  }

  const templateResult = Template.create(
    templateId.data,
    format.data,
    [], // empty mapping rules for mock
    `Mock template for ${name}`,
  );

  if (!templateResult.ok) {
    throw new Error(
      `Failed to create mock template: ${JSON.stringify(templateResult.error)}`,
    );
  }

  return templateResult.data;
}

/**
 * Creates mock frontmatter data with c1/c2/c3 fields
 */
export function createMockFrontMatter(options: {
  c1: string;
  c2: string;
  c3: string;
  additionalFields?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    c1: options.c1,
    c2: options.c2,
    c3: options.c3,
    ...options.additionalFields,
  };
}

/**
 * Creates mock frontmatter data missing specific c1/c2/c3 fields for error testing
 */
export function createMockFrontMatterWithMissingFields(
  missingFields: string[],
  additionalFields?: Record<string, unknown>,
): Record<string, unknown> {
  const baseFields: Record<string, unknown> = {
    c1: "default-c1",
    c2: "default-c2",
    c3: "default-c3",
    ...additionalFields,
  };

  // Remove the specified missing fields
  for (const field of missingFields) {
    delete baseFields[field];
  }

  return baseFields;
}

/**
 * Creates mock frontmatter with invalid types for c1/c2/c3 fields
 */
export function createMockFrontMatterWithInvalidTypes(): Record<
  string,
  unknown
> {
  return {
    c1: 123, // should be string
    c2: true, // should be string
    c3: ["array"], // should be string
    description: "Test with invalid types",
  };
}
