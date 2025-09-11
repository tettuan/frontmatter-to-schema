/**
 * Extension Processor Domain Service
 *
 * Domain Service for extension processing logic
 * Coordinates between registry and extension operations
 * Following DDD principles with proper separation of concerns
 */

import type { Result } from "../../core/result.ts";
import type { SchemaExtensionRegistry } from "../entities/schema-extension-registry.ts";
import type {
  ExtensionType,
  ExtensionValue,
} from "../value-objects/extension-value.ts";
// Import removed - createExtractionError not used in this service

/**
 * Processed extension data
 */
export interface ProcessedExtension {
  readonly type: ExtensionType;
  readonly value: ExtensionValue;
}

/**
 * Collection of processed extensions
 */
export interface ProcessedExtensions {
  readonly extensions: ProcessedExtension[];
}

/**
 * Processing error types
 */
export type ProcessingError =
  | { kind: "RegistryError"; details: string }
  | { kind: "ExtractionFailed"; extensionType: string; reason: string }
  | { kind: "ValidationFailed"; errors: string[] };

/**
 * Combination error types
 */
export type CombinationError =
  | { kind: "ConflictingExtensions"; extensions: string[] }
  | { kind: "MissingDependency"; required: string; dependent: string }
  | { kind: "InvalidCombination"; combination: string[] };

/**
 * Error creation helpers
 */
export const createProcessingError = (
  error: ProcessingError,
  customMessage?: string,
): ProcessingError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultProcessingErrorMessage(error),
});

export const createCombinationError = (
  error: CombinationError,
  customMessage?: string,
): CombinationError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultCombinationErrorMessage(error),
});

function getDefaultProcessingErrorMessage(error: ProcessingError): string {
  switch (error.kind) {
    case "RegistryError":
      return `Registry error: ${error.details}`;
    case "ExtractionFailed":
      return `Extension extraction failed for ${error.extensionType}: ${error.reason}`;
    case "ValidationFailed":
      return `Validation failed: ${error.errors.join(", ")}`;
  }
}

function getDefaultCombinationErrorMessage(error: CombinationError): string {
  switch (error.kind) {
    case "ConflictingExtensions":
      return `Conflicting extensions: ${error.extensions.join(", ")}`;
    case "MissingDependency":
      return `Missing dependency: ${error.required} required by ${error.dependent}`;
    case "InvalidCombination":
      return `Invalid extension combination: ${error.combination.join(", ")}`;
  }
}

/**
 * Domain Service for extension processing logic
 * Coordinates between registry and extension operations
 */
export class ExtensionProcessor {
  constructor(
    private readonly registry: SchemaExtensionRegistry,
  ) {}

  /**
   * Process all extensions in a schema using registry
   */
  async processExtensions(
    schema: Record<string, unknown>,
  ): Promise<
    Result<ProcessedExtensions, ProcessingError & { message: string }>
  > {
    try {
      const extractionResult = await this.registry.extractAllExtensions(schema);

      if (!extractionResult.ok) {
        return {
          ok: false,
          error: createProcessingError({
            kind: "ExtractionFailed",
            extensionType: "all",
            reason: extractionResult.error.message,
          }),
        };
      }

      const results: ProcessedExtension[] = [];

      for (const [extensionType, extensionValue] of extractionResult.data) {
        results.push({
          type: extensionType,
          value: extensionValue,
        });
      }

      return {
        ok: true,
        data: { extensions: results },
      };
    } catch (error) {
      return {
        ok: false,
        error: createProcessingError({
          kind: "RegistryError",
          details: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Process specific extension type
   */
  processExtension(
    schema: Record<string, unknown>,
    extensionType: ExtensionType,
  ): Result<ExtensionValue | null, ProcessingError & { message: string }> {
    try {
      const extractionResult = this.registry.extractExtensionValue(
        schema,
        extensionType,
      );

      if (!extractionResult.ok) {
        return {
          ok: false,
          error: createProcessingError({
            kind: "ExtractionFailed",
            extensionType: extensionType.getValue(),
            reason: extractionResult.error.message,
          }),
        };
      }

      return { ok: true, data: extractionResult.data };
    } catch (error) {
      return {
        ok: false,
        error: createProcessingError({
          kind: "RegistryError",
          details: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Validate extension combination rules
   */
  validateExtensionCombination(
    extensions: ExtensionValue[],
  ): Result<boolean, CombinationError & { message: string }> {
    // Business rule validation
    const booleanExtensions = extensions.filter((ext) =>
      ext.kind === "BooleanExtension"
    );
    const _objectExtensions = extensions.filter((ext) =>
      ext.kind === "ObjectExtension"
    );

    // Example rule: Cannot have more than one template configuration
    const templateExtensions = extensions.filter((ext) =>
      ext.metadata?.extensionType === "template"
    );

    if (templateExtensions.length > 1) {
      return {
        ok: false,
        error: createCombinationError({
          kind: "ConflictingExtensions",
          extensions: templateExtensions.map((ext) =>
            ext.metadata?.sourceProperty || "unknown"
          ),
        }),
      };
    }

    // Example rule: Derived extensions require frontmatter-part to be enabled
    const derivedExtensions = extensions.filter((ext) =>
      ext.metadata?.extensionType === "derived-from" ||
      ext.metadata?.extensionType === "derived-unique"
    );

    const frontmatterPartEnabled = booleanExtensions.some((ext) =>
      ext.metadata?.extensionType === "frontmatter-part" && ext.enabled
    );

    if (derivedExtensions.length > 0 && !frontmatterPartEnabled) {
      return {
        ok: false,
        error: createCombinationError({
          kind: "MissingDependency",
          required: "x-frontmatter-part",
          dependent: derivedExtensions[0].metadata?.sourceProperty ||
            "derived extension",
        }),
      };
    }

    return { ok: true, data: true };
  }

  /**
   * Get all supported extension types
   */
  async getAllExtensionTypes(): Promise<ExtensionType[]> {
    // Import ExtensionType constants
    const { ExtensionType } = await import(
      "../value-objects/extension-value.ts"
    );

    return [
      ExtensionType.FRONTMATTER_PART,
      ExtensionType.DERIVED_FROM,
      ExtensionType.DERIVED_UNIQUE,
      ExtensionType.TEMPLATE,
    ];
  }

  /**
   * Check if schema has any extensions
   */
  hasAnyExtensions(schema: Record<string, unknown>): boolean {
    // Check for any property starting with x-
    return Object.keys(schema).some((key) => key.startsWith("x-"));
  }

  /**
   * Extract extension metadata for debugging
   */
  getExtensionMetadata(
    schema: Record<string, unknown>,
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Get all x-* properties with their types
    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith("x-")) {
        metadata[key] = {
          type: typeof value,
          isArray: Array.isArray(value),
          isObject: value !== null && typeof value === "object" &&
            !Array.isArray(value),
          hasValue: value !== undefined && value !== null,
        };
      }
    }

    return metadata;
  }

  /**
   * Get registry for advanced operations
   */
  getRegistry(): SchemaExtensionRegistry {
    return this.registry;
  }
}
