/**
 * Schema Property Extractor Service
 * Extracts properties and required fields from schema definitions
 */

// import type { DomainError, Result } from "../core/result.ts";

export type SchemaProperties = {
  kind: "Present";
  value: Record<string, unknown>;
} | {
  kind: "NotPresent";
};

export type RequiredFields = {
  kind: "Present";
  fields: string[];
} | {
  kind: "NotPresent";
};

export class SchemaPropertyExtractorService {
  extractProperties(schema: Record<string, unknown>): SchemaProperties {
    if (schema.properties && typeof schema.properties === "object") {
      return {
        kind: "Present",
        value: schema.properties as Record<string, unknown>,
      };
    }
    return { kind: "NotPresent" };
  }

  extractRequiredFields(schema: Record<string, unknown>): RequiredFields {
    if (Array.isArray(schema.required)) {
      return {
        kind: "Present",
        fields: schema.required as string[],
      };
    }
    return { kind: "NotPresent" };
  }

  allowsAdditionalProperties(schema: Record<string, unknown>): boolean {
    return schema.additionalProperties !== false;
  }
}
