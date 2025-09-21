import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import { ConfigurationLoader } from "../../../../../src/domain/configuration/services/configuration-loader.ts";

describe("ConfigurationLoader", () => {
  describe("parseFromContent", () => {
    it("should parse valid YAML configuration", () => {
      const yamlContent = `
complexity_factors:
  class_count: 45
  interface_count: 12
  abstraction_layers: 4
  cyclomatic_complexity: 257
  dependency_depth: 6
  conditional_branches: 35
  generic_type_parameters: 8

entropy_thresholds:
  max_entropy: 25.0
  warning_entropy: 20.0
  target_entropy: 15.0

quality_gates:
  max_file_size: 140
  max_function_complexity: 10
  max_class_complexity: 20
`;

      const result = ConfigurationLoader.parseFromContent(yamlContent);

      assert(
        result.ok,
        `Expected successful parsing but got error: ${
          result.ok ? "" : result.error.message
        }`,
      );

      // Test complexity factors
      const complexityFactors = result.data.complexityFactors
        .toComplexityFactors();
      assertEquals(complexityFactors.classCount, 45);
      assertEquals(complexityFactors.interfaceCount, 12);
      assertEquals(complexityFactors.abstractionLayers, 4);
      assertEquals(complexityFactors.cyclomaticComplexity, 257);
      assertEquals(complexityFactors.dependencyDepth, 6);
      assertEquals(complexityFactors.conditionalBranches, 35);
      assertEquals(complexityFactors.genericTypeParameters, 8);

      // Test entropy thresholds
      assertEquals(result.data.entropyThresholds.maxEntropy, 25.0);
      assertEquals(result.data.entropyThresholds.warningEntropy, 20.0);
      assertEquals(result.data.entropyThresholds.targetEntropy, 15.0);

      // Test quality gates
      assertEquals(result.data.qualityGates.maxFileSize, 140);
      assertEquals(result.data.qualityGates.maxFunctionComplexity, 10);
      assertEquals(result.data.qualityGates.maxClassComplexity, 20);
    });

    it("should return error for invalid YAML", () => {
      const invalidYaml = `
complexity_factors:
  class_count: "invalid_number"
`;

      const result = ConfigurationLoader.parseFromContent(invalidYaml);

      assert(!result.ok, "Expected parsing to fail for invalid configuration");
      assert(result.error.message.includes("must be a number"));
    });

    it("should return error for missing required fields", () => {
      const incompleteYaml = `
complexity_factors:
  class_count: 45
# Missing other required fields
`;

      const result = ConfigurationLoader.parseFromContent(incompleteYaml);

      assert(
        !result.ok,
        "Expected parsing to fail for incomplete configuration",
      );
      assert(
        result.error.message.includes("Required") ||
          result.error.message.includes("missing"),
      );
    });

    it("should validate entropy threshold ordering", () => {
      const invalidOrderYaml = `
complexity_factors:
  class_count: 45
  interface_count: 12
  abstraction_layers: 4
  cyclomatic_complexity: 257
  dependency_depth: 6
  conditional_branches: 35
  generic_type_parameters: 8

entropy_thresholds:
  max_entropy: 15.0
  warning_entropy: 20.0  # Warning should be less than max
  target_entropy: 25.0   # Target should be less than warning

quality_gates:
  max_file_size: 140
  max_function_complexity: 10
  max_class_complexity: 20
`;

      const result = ConfigurationLoader.parseFromContent(invalidOrderYaml);

      assert(
        !result.ok,
        "Expected parsing to fail for invalid entropy threshold ordering",
      );
      assert(result.error.message.includes("less than"));
    });

    it("should validate complexity factor constraints", () => {
      const negativeValueYaml = `
complexity_factors:
  class_count: -5  # Should be non-negative
  interface_count: 12
  abstraction_layers: 4
  cyclomatic_complexity: 257
  dependency_depth: 6
  conditional_branches: 35
  generic_type_parameters: 8

entropy_thresholds:
  max_entropy: 25.0
  warning_entropy: 20.0
  target_entropy: 15.0

quality_gates:
  max_file_size: 140
  max_function_complexity: 10
  max_class_complexity: 20
`;

      const result = ConfigurationLoader.parseFromContent(negativeValueYaml);

      assert(!result.ok, "Expected parsing to fail for negative values");
      assert(result.error.message.includes("non-negative"));
    });
  });
});
