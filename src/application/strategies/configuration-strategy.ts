import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";

/**
 * Configuration strategy interface for providing default values.
 * Replaces hardcoded defaults with configurable strategy patterns.
 */
export interface ConfigurationStrategy {
  readonly strategyName: string;
  getDefaultValue<T>(
    key: string,
    requestedType: string,
  ): Result<T, ProcessingError>;
  hasDefault(key: string): boolean;
}

/**
 * Standard configuration strategy with common defaults.
 */
export class StandardConfigurationStrategy implements ConfigurationStrategy {
  readonly strategyName = "standard";

  private readonly defaults = new Map<string, { value: unknown; type: string }>(
    [
      ["outputFormat", { value: "json", type: "string" }],
      ["inputExtensions", { value: [".md", ".markdown"], type: "array" }],
      ["maxDepth", { value: 10, type: "number" }],
      ["includeMetadata", { value: true, type: "boolean" }],
      ["errorMessages", { value: this.createErrorMessages(), type: "object" }],
    ],
  );

  getDefaultValue<T>(
    key: string,
    requestedType: string,
  ): Result<T, ProcessingError> {
    const defaultEntry = this.defaults.get(key);

    if (!defaultEntry) {
      return Result.error(
        new ProcessingError(
          `No default value configured for key: ${key}`,
          "DEFAULT_VALUE_NOT_FOUND",
          { key, requestedType },
        ),
      );
    }

    if (defaultEntry.type !== requestedType) {
      return Result.error(
        new ProcessingError(
          `Type mismatch for default value: expected ${requestedType}, got ${defaultEntry.type}`,
          "DEFAULT_VALUE_TYPE_MISMATCH",
          { key, expectedType: requestedType, actualType: defaultEntry.type },
        ),
      );
    }

    return Result.ok(defaultEntry.value as T);
  }

  hasDefault(key: string): boolean {
    return this.defaults.has(key);
  }

  private createErrorMessages(): Record<string, string> {
    return {
      "SCHEMA_READ_ERROR": "Failed to read schema file",
      "TEMPLATE_LOAD_ERROR": "Template loading failed",
      "DOCUMENT_READ_ERROR": "Failed to read document",
      "DIRECTORY_READ_ERROR": "Cannot read directory",
      "NO_DOCUMENTS_FOUND": "No valid documents found in directory",
      "INVALID_INPUT_PATH": "Input path must be a file or directory",
      "FRONTMATTER_PARSE_ERROR": "Frontmatter parsing failed",
      "TRANSFORMATION_ERROR": "Document transformation failed",
      "RENDERING_ERROR": "Output rendering failed",
      "OUTPUT_WRITE_ERROR": "Failed to write output",
    };
  }
}

/**
 * Custom configuration strategy for specific use cases.
 */
export class CustomConfigurationStrategy implements ConfigurationStrategy {
  readonly strategyName = "custom";

  constructor(
    private readonly customDefaults: Map<
      string,
      { value: unknown; type: string }
    >,
  ) {}

  getDefaultValue<T>(
    key: string,
    requestedType: string,
  ): Result<T, ProcessingError> {
    const defaultEntry = this.customDefaults.get(key);

    if (!defaultEntry) {
      return Result.error(
        new ProcessingError(
          `No custom default value configured for key: ${key}`,
          "CUSTOM_DEFAULT_VALUE_NOT_FOUND",
          { key, requestedType },
        ),
      );
    }

    if (defaultEntry.type !== requestedType) {
      return Result.error(
        new ProcessingError(
          `Type mismatch for custom default value: expected ${requestedType}, got ${defaultEntry.type}`,
          "CUSTOM_DEFAULT_VALUE_TYPE_MISMATCH",
          { key, expectedType: requestedType, actualType: defaultEntry.type },
        ),
      );
    }

    return Result.ok(defaultEntry.value as T);
  }

  hasDefault(key: string): boolean {
    return this.customDefaults.has(key);
  }

  static builder(): CustomConfigurationBuilder {
    return new CustomConfigurationBuilder();
  }
}

/**
 * Builder for creating custom configuration strategies.
 */
export class CustomConfigurationBuilder {
  private readonly defaults = new Map<
    string,
    { value: unknown; type: string }
  >();

  withDefault<T>(key: string, value: T, type: string): this {
    this.defaults.set(key, { value, type });
    return this;
  }

  withStringDefault(key: string, value: string): this {
    return this.withDefault(key, value, "string");
  }

  withNumberDefault(key: string, value: number): this {
    return this.withDefault(key, value, "number");
  }

  withBooleanDefault(key: string, value: boolean): this {
    return this.withDefault(key, value, "boolean");
  }

  withArrayDefault<T>(key: string, value: T[]): this {
    return this.withDefault(key, value, "array");
  }

  withObjectDefault(key: string, value: Record<string, unknown>): this {
    return this.withDefault(key, value, "object");
  }

  build(): CustomConfigurationStrategy {
    return new CustomConfigurationStrategy(new Map(this.defaults));
  }
}

/**
 * Configuration manager that coordinates multiple configuration strategies.
 */
export class ConfigurationManager {
  private readonly strategies: ConfigurationStrategy[] = [];
  private primaryStrategy: ConfigurationStrategy;

  constructor(primaryStrategy?: ConfigurationStrategy) {
    this.primaryStrategy = primaryStrategy ||
      new StandardConfigurationStrategy();
    this.strategies.push(this.primaryStrategy);
  }

  addFallbackStrategy(strategy: ConfigurationStrategy): void {
    this.strategies.push(strategy);
  }

  getDefaultValue<T>(
    key: string,
    requestedType: string,
  ): Result<T, ProcessingError> {
    for (const strategy of this.strategies) {
      if (strategy.hasDefault(key)) {
        return strategy.getDefaultValue<T>(key, requestedType);
      }
    }

    return Result.error(
      new ProcessingError(
        `No default value found for key: ${key} across all strategies`,
        "NO_DEFAULT_VALUE_FOUND",
        {
          key,
          requestedType,
          availableStrategies: this.strategies.map((s) => s.strategyName),
        },
      ),
    );
  }

  getStringDefault(key: string): Result<string, ProcessingError> {
    return this.getDefaultValue<string>(key, "string");
  }

  getNumberDefault(key: string): Result<number, ProcessingError> {
    return this.getDefaultValue<number>(key, "number");
  }

  getBooleanDefault(key: string): Result<boolean, ProcessingError> {
    return this.getDefaultValue<boolean>(key, "boolean");
  }

  getArrayDefault<T>(key: string): Result<T[], ProcessingError> {
    return this.getDefaultValue<T[]>(key, "array");
  }

  getObjectDefault(
    key: string,
  ): Result<Record<string, unknown>, ProcessingError> {
    return this.getDefaultValue<Record<string, unknown>>(key, "object");
  }
}
