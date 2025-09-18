import { parse as parseYaml } from "jsr:@std/yaml@1.0.5";
import { Result } from "../../shared/types/result.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
import {
  ComplexityFactorsConfig,
  ConfigurationError,
  EntropyThresholdsConfig,
  QualityGatesConfig,
} from "../value-objects/complexity-metrics-config.ts";

/**
 * Complete complexity metrics configuration
 */
export class ComplexityMetricsConfiguration {
  private constructor(
    readonly complexityFactors: ComplexityFactorsConfig,
    readonly entropyThresholds: EntropyThresholdsConfig,
    readonly qualityGates: QualityGatesConfig,
  ) {}

  static create(
    complexityFactors: ComplexityFactorsConfig,
    entropyThresholds: EntropyThresholdsConfig,
    qualityGates: QualityGatesConfig,
  ): ComplexityMetricsConfiguration {
    return new ComplexityMetricsConfiguration(
      complexityFactors,
      entropyThresholds,
      qualityGates,
    );
  }
}

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
 * Configuration loader service following Totality principles
 * Loads and validates complexity metrics configuration from YAML files
 */
export class ConfigurationLoader {
  /**
   * Load configuration from file content (pure function for testing)
   */
  static parseFromContent(
    content: string,
  ): Result<
    ComplexityMetricsConfiguration,
    ConfigurationError & { message: string }
  > {
    // Parse YAML
    let parsed: unknown;
    try {
      parsed = parseYaml(content);
    } catch (error) {
      return {
        ok: false,
        error: createConfigError({
          kind: "ParseError",
          message: error instanceof Error
            ? error.message
            : "Unknown parse error",
        }),
      };
    }

    // Validate top-level structure
    if (!parsed || typeof parsed !== "object") {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message: "Configuration must be a YAML object",
        }),
      };
    }

    const configResult = SafePropertyAccess.asRecord(parsed);
    if (!configResult.ok) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message:
            `Configuration is not a valid object: ${configResult.error.message}`,
        }),
      };
    }
    const config = configResult.data;

    // Extract complexity_factors
    const complexityFactorsResult = this.extractComplexityFactors(config);
    if (!complexityFactorsResult.ok) {
      return complexityFactorsResult;
    }

    // Extract entropy_thresholds
    const entropyThresholdsResult = this.extractEntropyThresholds(config);
    if (!entropyThresholdsResult.ok) {
      return entropyThresholdsResult;
    }

    // Extract quality_gates
    const qualityGatesResult = this.extractQualityGates(config);
    if (!qualityGatesResult.ok) {
      return qualityGatesResult;
    }

    return {
      ok: true,
      data: ComplexityMetricsConfiguration.create(
        complexityFactorsResult.data,
        entropyThresholdsResult.data,
        qualityGatesResult.data,
      ),
    };
  }

  /**
   * Load configuration from file path
   */
  static async loadFromFile(
    filePath: string,
  ): Promise<
    Result<
      ComplexityMetricsConfiguration,
      ConfigurationError & { message: string }
    >
  > {
    // Read file
    let content: string;
    try {
      content = await Deno.readTextFile(filePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createConfigError({
            kind: "FileNotFound",
            path: filePath,
          }),
        };
      }
      return {
        ok: false,
        error: createConfigError({
          kind: "ParseError",
          message: error instanceof Error
            ? error.message
            : "Failed to read file",
        }),
      };
    }

    return this.parseFromContent(content);
  }

  private static extractComplexityFactors(
    config: Record<string, unknown>,
  ): Result<ComplexityFactorsConfig, ConfigurationError & { message: string }> {
    const complexityFactors = config.complexity_factors;
    if (!complexityFactors) {
      return {
        ok: false,
        error: createConfigError({
          kind: "MissingField",
          field: "complexity_factors",
        }),
      };
    }

    if (typeof complexityFactors !== "object" || complexityFactors === null) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message: "complexity_factors must be an object",
        }),
      };
    }

    const factorsResult = SafePropertyAccess.asRecord(complexityFactors);
    if (!factorsResult.ok) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message:
            `complexity_factors is not a valid object: ${factorsResult.error.message}`,
        }),
      };
    }
    const factors = factorsResult.data;

    // Extract and validate each field
    const requiredFields = [
      "class_count",
      "interface_count",
      "abstraction_layers",
      "cyclomatic_complexity",
      "dependency_depth",
      "conditional_branches",
      "generic_type_parameters",
    ];

    const extractedData: Record<string, number> = {};

    for (const field of requiredFields) {
      const value = factors[field];
      if (value === undefined) {
        return {
          ok: false,
          error: createConfigError({
            kind: "MissingField",
            field: `complexity_factors.${field}`,
          }),
        };
      }

      if (typeof value !== "number") {
        return {
          ok: false,
          error: createConfigError({
            kind: "InvalidValue",
            field: `complexity_factors.${field}`,
            value,
            constraint: "must be a number",
          }),
        };
      }

      // Convert snake_case to camelCase for the value object
      const camelCaseField = field.replace(
        /_([a-z])/g,
        (_, letter) => letter.toUpperCase(),
      );
      extractedData[camelCaseField] = value;
    }

    return ComplexityFactorsConfig.create({
      classCount: extractedData.classCount,
      interfaceCount: extractedData.interfaceCount,
      abstractionLayers: extractedData.abstractionLayers,
      cyclomaticComplexity: extractedData.cyclomaticComplexity,
      dependencyDepth: extractedData.dependencyDepth,
      conditionalBranches: extractedData.conditionalBranches,
      genericTypeParameters: extractedData.genericTypeParameters,
    });
  }

  private static extractEntropyThresholds(
    config: Record<string, unknown>,
  ): Result<EntropyThresholdsConfig, ConfigurationError & { message: string }> {
    const entropyThresholds = config.entropy_thresholds;
    if (!entropyThresholds) {
      return {
        ok: false,
        error: createConfigError({
          kind: "MissingField",
          field: "entropy_thresholds",
        }),
      };
    }

    if (typeof entropyThresholds !== "object" || entropyThresholds === null) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message: "entropy_thresholds must be an object",
        }),
      };
    }

    const thresholdsResult = SafePropertyAccess.asRecord(entropyThresholds);
    if (!thresholdsResult.ok) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message:
            `entropy_thresholds is not a valid object: ${thresholdsResult.error.message}`,
        }),
      };
    }
    const thresholds = thresholdsResult.data;

    const maxEntropy = thresholds.max_entropy;
    const warningEntropy = thresholds.warning_entropy;
    const targetEntropy = thresholds.target_entropy;

    if (typeof maxEntropy !== "number") {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "entropy_thresholds.max_entropy",
          value: maxEntropy,
          constraint: "must be a number",
        }),
      };
    }

    if (typeof warningEntropy !== "number") {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "entropy_thresholds.warning_entropy",
          value: warningEntropy,
          constraint: "must be a number",
        }),
      };
    }

    if (typeof targetEntropy !== "number") {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "entropy_thresholds.target_entropy",
          value: targetEntropy,
          constraint: "must be a number",
        }),
      };
    }

    return EntropyThresholdsConfig.create({
      maxEntropy,
      warningEntropy,
      targetEntropy,
    });
  }

  private static extractQualityGates(
    config: Record<string, unknown>,
  ): Result<QualityGatesConfig, ConfigurationError & { message: string }> {
    const qualityGates = config.quality_gates;
    if (!qualityGates) {
      return {
        ok: false,
        error: createConfigError({
          kind: "MissingField",
          field: "quality_gates",
        }),
      };
    }

    if (typeof qualityGates !== "object" || qualityGates === null) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message: "quality_gates must be an object",
        }),
      };
    }

    const gatesResult = SafePropertyAccess.asRecord(qualityGates);
    if (!gatesResult.ok) {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidFormat",
          message:
            `quality_gates is not a valid object: ${gatesResult.error.message}`,
        }),
      };
    }
    const gates = gatesResult.data;

    const maxFileSize = gates.max_file_size;
    const maxFunctionComplexity = gates.max_function_complexity;
    const maxClassComplexity = gates.max_class_complexity;

    if (typeof maxFileSize !== "number") {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "quality_gates.max_file_size",
          value: maxFileSize,
          constraint: "must be a number",
        }),
      };
    }

    if (typeof maxFunctionComplexity !== "number") {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "quality_gates.max_function_complexity",
          value: maxFunctionComplexity,
          constraint: "must be a number",
        }),
      };
    }

    if (typeof maxClassComplexity !== "number") {
      return {
        ok: false,
        error: createConfigError({
          kind: "InvalidValue",
          field: "quality_gates.max_class_complexity",
          value: maxClassComplexity,
          constraint: "must be a number",
        }),
      };
    }

    return QualityGatesConfig.create({
      maxFileSize,
      maxFunctionComplexity,
      maxClassComplexity,
    });
  }
}
