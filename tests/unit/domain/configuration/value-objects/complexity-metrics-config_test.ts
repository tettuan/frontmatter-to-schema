import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import {
  ComplexityFactorsConfig,
  EntropyThresholdsConfig,
  QualityGatesConfig,
} from "../../../../../src/domain/configuration/value-objects/complexity-metrics-config.ts";

describe("ComplexityFactorsConfig", () => {
  describe("create", () => {
    it("should create valid complexity factors config", () => {
      const result = ComplexityFactorsConfig.create({
        classCount: 45,
        interfaceCount: 12,
        abstractionLayers: 4,
        cyclomaticComplexity: 257,
        dependencyDepth: 6,
        conditionalBranches: 35,
        genericTypeParameters: 8,
      });

      assert(
        result.ok,
        `Expected successful creation but got error: ${
          result.ok ? "" : result.error.message
        }`,
      );
      assertEquals(result.data.classCount, 45);
      assertEquals(result.data.interfaceCount, 12);
    });

    it("should reject negative values", () => {
      const result = ComplexityFactorsConfig.create({
        classCount: -1,
        interfaceCount: 12,
        abstractionLayers: 4,
        cyclomaticComplexity: 257,
        dependencyDepth: 6,
        conditionalBranches: 35,
        genericTypeParameters: 8,
      });

      assert(!result.ok, "Expected creation to fail for negative values");
      assert(result.error.message.includes("non-negative"));
    });

    it("should reject non-integer values", () => {
      const result = ComplexityFactorsConfig.create({
        classCount: 45.5,
        interfaceCount: 12,
        abstractionLayers: 4,
        cyclomaticComplexity: 257,
        dependencyDepth: 6,
        conditionalBranches: 35,
        genericTypeParameters: 8,
      });

      assert(!result.ok, "Expected creation to fail for non-integer values");
      assert(result.error.message.includes("integer"));
    });

    it("should validate abstraction layers range", () => {
      const result = ComplexityFactorsConfig.create({
        classCount: 45,
        interfaceCount: 12,
        abstractionLayers: 0, // Should be between 1 and 10
        cyclomaticComplexity: 257,
        dependencyDepth: 6,
        conditionalBranches: 35,
        genericTypeParameters: 8,
      });

      assert(
        !result.ok,
        "Expected creation to fail for out-of-range abstraction layers",
      );
      assert(result.error.message.includes("between 1 and 10"));
    });

    it("should convert to ComplexityFactors interface", () => {
      const result = ComplexityFactorsConfig.create({
        classCount: 45,
        interfaceCount: 12,
        abstractionLayers: 4,
        cyclomaticComplexity: 257,
        dependencyDepth: 6,
        conditionalBranches: 35,
        genericTypeParameters: 8,
      });

      assert(result.ok);
      const factors = result.data.toComplexityFactors();
      assertEquals(factors.classCount, 45);
      assertEquals(factors.interfaceCount, 12);
      assertEquals(factors.abstractionLayers, 4);
    });
  });
});

describe("EntropyThresholdsConfig", () => {
  describe("create", () => {
    it("should create valid entropy thresholds config", () => {
      const result = EntropyThresholdsConfig.create({
        maxEntropy: 25.0,
        warningEntropy: 20.0,
        targetEntropy: 15.0,
      });

      assert(
        result.ok,
        `Expected successful creation but got error: ${
          result.ok ? "" : result.error.message
        }`,
      );
      assertEquals(result.data.maxEntropy, 25.0);
      assertEquals(result.data.warningEntropy, 20.0);
      assertEquals(result.data.targetEntropy, 15.0);
    });

    it("should reject invalid threshold ordering", () => {
      const result = EntropyThresholdsConfig.create({
        maxEntropy: 15.0,
        warningEntropy: 20.0, // Should be less than maxEntropy
        targetEntropy: 10.0,
      });

      assert(
        !result.ok,
        "Expected creation to fail for invalid threshold ordering",
      );
      assert(result.error.message.includes("less than maxEntropy"));
    });
  });
});

describe("QualityGatesConfig", () => {
  describe("create", () => {
    it("should create valid quality gates config", () => {
      const result = QualityGatesConfig.create({
        maxFileSize: 140,
        maxFunctionComplexity: 10,
        maxClassComplexity: 20,
      });

      assert(
        result.ok,
        `Expected successful creation but got error: ${
          result.ok ? "" : result.error.message
        }`,
      );
      assertEquals(result.data.maxFileSize, 140);
      assertEquals(result.data.maxFunctionComplexity, 10);
      assertEquals(result.data.maxClassComplexity, 20);
    });

    it("should reject invalid file size", () => {
      const result = QualityGatesConfig.create({
        maxFileSize: 5, // Should be >= 10
        maxFunctionComplexity: 10,
        maxClassComplexity: 20,
      });

      assert(!result.ok, "Expected creation to fail for invalid file size");
      assert(result.error.message.includes(">= 10"));
    });
  });
});
