import { Result } from "../../shared/types/result.ts";

/**
 * Configuration validation errors following Totality principles
 */
export type ConfigurationError =
  | { kind: "InvalidValue"; field: string; value: unknown; constraint: string }
  | { kind: "MissingField"; field: string }
  | { kind: "InvalidFormat"; message: string }
  | { kind: "FileNotFound"; path: string }
  | { kind: "ParseError"; message: string };

/**
 * Helper function to create configuration errors with messages
 */
const createConfigError = (
  error: ConfigurationError,
  customMessage?: string,
): ConfigurationError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultConfigMessage(error),
});

const getDefaultConfigMessage = (error: ConfigurationError): string => {
  switch (error.kind) {
    case "InvalidValue":
      return `Field "${error.field}" has invalid value ${error.value}: ${error.constraint}`;
    case "MissingField":
      return `Required field "${error.field}" is missing`;
    case "InvalidFormat":
      return `Invalid configuration format: ${error.message}`;
    case "FileNotFound":
      return `Configuration file not found: ${error.path}`;
    case "ParseError":
      return `Failed to parse configuration: ${error.message}`;
  }
};

/**
 * Complexity factors configuration value object
 * Follows Totality principles with Smart Constructor pattern
 */
export class ComplexityFactorsConfig {
  private constructor(
    readonly classCount: number,
    readonly interfaceCount: number,
    readonly abstractionLayers: number,
    readonly cyclomaticComplexity: number,
    readonly dependencyDepth: number,
    readonly conditionalBranches: number,
    readonly genericTypeParameters: number,
  ) {}

  /**
   * Smart constructor for ComplexityFactorsConfig
   * Validates all constraints and returns Result<T,E>
   */
  static create(data: {
    classCount: number;
    interfaceCount: number;
    abstractionLayers: number;
    cyclomaticComplexity: number;
    dependencyDepth: number;
    conditionalBranches: number;
    genericTypeParameters: number;
  }): Result<
    ComplexityFactorsConfig,
    ConfigurationError & { message: string }
  > {
    // Validate classCount
    if (!Number.isInteger(data.classCount) || data.classCount < 0) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "classCount",
          value: data.classCount,
          constraint: "must be a non-negative integer",
        }),
      };
    }

    // Validate interfaceCount
    if (!Number.isInteger(data.interfaceCount) || data.interfaceCount < 0) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "interfaceCount",
          value: data.interfaceCount,
          constraint: "must be a non-negative integer",
        }),
      };
    }

    // Validate abstractionLayers
    if (
      !Number.isInteger(data.abstractionLayers) ||
      data.abstractionLayers < 1 || data.abstractionLayers > 10
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "abstractionLayers",
          value: data.abstractionLayers,
          constraint: "must be an integer between 1 and 10",
        }),
      };
    }

    // Validate cyclomaticComplexity
    if (
      !Number.isInteger(data.cyclomaticComplexity) ||
      data.cyclomaticComplexity < 1
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "cyclomaticComplexity",
          value: data.cyclomaticComplexity,
          constraint: "must be a positive integer",
        }),
      };
    }

    // Validate dependencyDepth
    if (
      !Number.isInteger(data.dependencyDepth) ||
      data.dependencyDepth < 1 || data.dependencyDepth > 20
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "dependencyDepth",
          value: data.dependencyDepth,
          constraint: "must be an integer between 1 and 20",
        }),
      };
    }

    // Validate conditionalBranches
    if (
      !Number.isInteger(data.conditionalBranches) ||
      data.conditionalBranches < 0
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "conditionalBranches",
          value: data.conditionalBranches,
          constraint: "must be a non-negative integer",
        }),
      };
    }

    // Validate genericTypeParameters
    if (
      !Number.isInteger(data.genericTypeParameters) ||
      data.genericTypeParameters < 0
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "genericTypeParameters",
          value: data.genericTypeParameters,
          constraint: "must be a non-negative integer",
        }),
      };
    }

    return {
      ok: true,
      data: new ComplexityFactorsConfig(
        data.classCount,
        data.interfaceCount,
        data.abstractionLayers,
        data.cyclomaticComplexity,
        data.dependencyDepth,
        data.conditionalBranches,
        data.genericTypeParameters,
      ),
    };
  }

  /**
   * Convert to the legacy ComplexityFactors interface for backward compatibility
   */
  toComplexityFactors(): {
    readonly classCount: number;
    readonly interfaceCount: number;
    readonly abstractionLayers: number;
    readonly cyclomaticComplexity: number;
    readonly dependencyDepth: number;
    readonly conditionalBranches: number;
    readonly genericTypeParameters: number;
  } {
    return {
      classCount: this.classCount,
      interfaceCount: this.interfaceCount,
      abstractionLayers: this.abstractionLayers,
      cyclomaticComplexity: this.cyclomaticComplexity,
      dependencyDepth: this.dependencyDepth,
      conditionalBranches: this.conditionalBranches,
      genericTypeParameters: this.genericTypeParameters,
    };
  }
}

/**
 * Entropy thresholds configuration value object
 */
export class EntropyThresholdsConfig {
  private constructor(
    readonly maxEntropy: number,
    readonly warningEntropy: number,
    readonly targetEntropy: number,
  ) {}

  static create(data: {
    maxEntropy: number;
    warningEntropy: number;
    targetEntropy: number;
  }): Result<
    EntropyThresholdsConfig,
    ConfigurationError & { message: string }
  > {
    // Validate maxEntropy
    if (typeof data.maxEntropy !== "number" || data.maxEntropy <= 0) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "maxEntropy",
          value: data.maxEntropy,
          constraint: "must be a positive number",
        }),
      };
    }

    // Validate warningEntropy
    if (
      typeof data.warningEntropy !== "number" || data.warningEntropy <= 0 ||
      data.warningEntropy >= data.maxEntropy
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "warningEntropy",
          value: data.warningEntropy,
          constraint: "must be a positive number less than maxEntropy",
        }),
      };
    }

    // Validate targetEntropy
    if (
      typeof data.targetEntropy !== "number" || data.targetEntropy <= 0 ||
      data.targetEntropy >= data.warningEntropy
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "targetEntropy",
          value: data.targetEntropy,
          constraint: "must be a positive number less than warningEntropy",
        }),
      };
    }

    return {
      ok: true,
      data: new EntropyThresholdsConfig(
        data.maxEntropy,
        data.warningEntropy,
        data.targetEntropy,
      ),
    };
  }
}

/**
 * Quality gates configuration value object
 */
export class QualityGatesConfig {
  private constructor(
    readonly maxFileSize: number,
    readonly maxFunctionComplexity: number,
    readonly maxClassComplexity: number,
  ) {}

  static create(data: {
    maxFileSize: number;
    maxFunctionComplexity: number;
    maxClassComplexity: number;
  }): Result<QualityGatesConfig, ConfigurationError & { message: string }> {
    // Validate maxFileSize
    if (!Number.isInteger(data.maxFileSize) || data.maxFileSize < 10) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "maxFileSize",
          value: data.maxFileSize,
          constraint: "must be an integer >= 10",
        }),
      };
    }

    // Validate maxFunctionComplexity
    if (
      !Number.isInteger(data.maxFunctionComplexity) ||
      data.maxFunctionComplexity < 1
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "maxFunctionComplexity",
          value: data.maxFunctionComplexity,
          constraint: "must be a positive integer",
        }),
      };
    }

    // Validate maxClassComplexity
    if (
      !Number.isInteger(data.maxClassComplexity) ||
      data.maxClassComplexity < 1
    ) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "maxClassComplexity",
          value: data.maxClassComplexity,
          constraint: "must be a positive integer",
        }),
      };
    }

    return {
      ok: true,
      data: new QualityGatesConfig(
        data.maxFileSize,
        data.maxFunctionComplexity,
        data.maxClassComplexity,
      ),
    };
  }
}
