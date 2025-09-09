/**
 * Schema Configuration Service
 * Handles schema configuration management
 */

import type { DomainError, Result } from "../core/result.ts";

export interface SchemaConfig {
  id: string;
  path: string;
  version: string;
}

export class SchemaConfigurationService {
  loadConfiguration(
    configData: Record<string, unknown>,
  ): Result<SchemaConfig, DomainError> {
    if (!configData.schema || typeof configData.schema !== "object") {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: "schema configuration",
          expectedFormat: "object",
        },
      };
    }

    const schemaConfig = configData.schema as Record<string, unknown>;

    if (
      typeof schemaConfig.id !== "string" ||
      typeof schemaConfig.path !== "string" ||
      typeof schemaConfig.version !== "string"
    ) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: "schema configuration fields",
          expectedFormat: "id, path, and version as strings",
        },
      };
    }

    return {
      ok: true,
      data: {
        id: schemaConfig.id,
        path: schemaConfig.path,
        version: schemaConfig.version,
      },
    };
  }
}
