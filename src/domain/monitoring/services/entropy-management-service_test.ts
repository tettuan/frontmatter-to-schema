import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import {
  ComplexityFactors,
  EntropyManagementService,
} from "./entropy-management-service.ts";

describe("EntropyManagementService", () => {
  describe("Smart Constructor", () => {
    it("should create service with default configuration", () => {
      const result = EntropyManagementService.create();
      assertEquals(result.ok, true);
    });

    it("should create service with custom configuration", () => {
      const result = EntropyManagementService.create({
        acceptableThreshold: 10.0,
        warningThreshold: 15.0,
        criticalThreshold: 20.0,
        baseComplexity: 2.0,
      });
      assertEquals(result.ok, true);
    });

    it("should reject invalid threshold ordering", () => {
      const result = EntropyManagementService.create({
        acceptableThreshold: 20.0,
        warningThreshold: 15.0,
        criticalThreshold: 10.0,
      });
      assertEquals(result.ok, false);
      if (!result.ok) {
        assert(result.error.message.includes("order"));
      }
    });

    it("should reject negative thresholds", () => {
      const result = EntropyManagementService.create({
        acceptableThreshold: -1.0,
      });
      assertEquals(result.ok, false);
      if (!result.ok) {
        assert(result.error.message.includes("positive"));
      }
    });
  });

  describe("Entropy Calculation", () => {
    it("should calculate entropy for minimal complexity", () => {
      const serviceResult = EntropyManagementService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors: ComplexityFactors = {
        fileCount: 1,
        schemaComplexity: 1,
        templateComplexity: 1,
        aggregationComplexity: 0,
        parallelismLevel: 1,
        errorHandlingComplexity: 1,
        stateSpaceSize: 5,
        integrationPoints: 1,
      };

      const result = service.calculateSystemEntropy(factors);
      assertEquals(result.ok, true);
      if (result.ok) {
        assert(result.data > 0);
        assert(result.data < 10); // Should be low for minimal complexity
      }
    });

    it("should calculate entropy for high complexity", () => {
      const serviceResult = EntropyManagementService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors: ComplexityFactors = {
        fileCount: 100,
        schemaComplexity: 20,
        templateComplexity: 15,
        aggregationComplexity: 10,
        parallelismLevel: 8,
        errorHandlingComplexity: 12,
        stateSpaceSize: 100,
        integrationPoints: 10,
      };

      const result = service.calculateSystemEntropy(factors);
      assertEquals(result.ok, true);
      if (result.ok) {
        assert(result.data > 7); // Should be high for complex system (>7 bits)
        assert(result.data < 10); // But not extreme
      }
    });

    it("should reject negative complexity factors", () => {
      const serviceResult = EntropyManagementService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors: ComplexityFactors = {
        fileCount: -1,
        schemaComplexity: 1,
        templateComplexity: 1,
        aggregationComplexity: 0,
        parallelismLevel: 1,
        errorHandlingComplexity: 1,
        stateSpaceSize: 5,
        integrationPoints: 1,
      };

      const result = service.calculateSystemEntropy(factors);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidType");
      }
    });
  });

  describe("Reduction Plan Generation", () => {
    it("should generate plan for high complexity system", () => {
      const serviceResult = EntropyManagementService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors: ComplexityFactors = {
        fileCount: 50,
        schemaComplexity: 15,
        templateComplexity: 10,
        aggregationComplexity: 8,
        parallelismLevel: 4,
        errorHandlingComplexity: 10,
        stateSpaceSize: 60,
        integrationPoints: 5,
      };

      const result = service.generateReductionPlan(factors);
      assertEquals(result.ok, true);
      if (result.ok) {
        const plan = result.data;
        assert(plan.reductionStrategies.length > 0);
        assert(plan.currentEntropy > 0);
        assert(plan.targetEntropy <= plan.currentEntropy);
        assert(plan.estimatedReduction > 0);
      }
    });

    it("should generate empty plan for acceptable complexity", () => {
      const serviceResult = EntropyManagementService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors: ComplexityFactors = {
        fileCount: 1,
        schemaComplexity: 2,
        templateComplexity: 1,
        aggregationComplexity: 1,
        parallelismLevel: 1,
        errorHandlingComplexity: 2,
        stateSpaceSize: 10,
        integrationPoints: 1,
      };

      const result = service.generateReductionPlan(factors);
      assertEquals(result.ok, true);
      if (result.ok) {
        const plan = result.data;
        assertEquals(plan.priority, "low");
      }
    });
  });

  describe("Reduction Application", () => {
    it("should apply simplification strategies", () => {
      const serviceResult = EntropyManagementService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors: ComplexityFactors = {
        fileCount: 10,
        schemaComplexity: 20,
        templateComplexity: 15,
        aggregationComplexity: 5,
        parallelismLevel: 2,
        errorHandlingComplexity: 5,
        stateSpaceSize: 30,
        integrationPoints: 3,
      };

      const strategies = [
        {
          kind: "simplification" as const,
          target: "Schema structure",
          impact: 2.0,
          effort: "moderate" as const,
        },
      ];

      const result = service.applyReduction(factors, strategies);
      assertEquals(result.ok, true);
      if (result.ok) {
        const updated = result.data;
        assert(updated.schemaComplexity < factors.schemaComplexity);
        assertEquals(updated.fileCount, factors.fileCount); // Others unchanged
      }
    });

    it("should handle empty strategies", () => {
      const serviceResult = EntropyManagementService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors: ComplexityFactors = {
        fileCount: 10,
        schemaComplexity: 5,
        templateComplexity: 3,
        aggregationComplexity: 2,
        parallelismLevel: 1,
        errorHandlingComplexity: 2,
        stateSpaceSize: 15,
        integrationPoints: 2,
      };

      const result = service.applyReduction(factors, []);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, factors);
      }
    });
  });

  describe("Entropy Acceptance", () => {
    it("should accept low entropy", () => {
      const serviceResult = EntropyManagementService.create({
        acceptableThreshold: 12.0,
      });
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      assertEquals(service.isAcceptable(10.0), true);
    });

    it("should reject high entropy", () => {
      const serviceResult = EntropyManagementService.create({
        acceptableThreshold: 12.0,
      });
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      assertEquals(service.isAcceptable(15.0), false);
    });
  });

  describe("Threshold Reporting", () => {
    it("should return configured thresholds", () => {
      const serviceResult = EntropyManagementService.create({
        acceptableThreshold: 10.0,
        warningThreshold: 15.0,
        criticalThreshold: 20.0,
      });
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const thresholds = service.getThresholds();
      assertEquals(thresholds.acceptable, 10.0);
      assertEquals(thresholds.warning, 15.0);
      assertEquals(thresholds.critical, 20.0);
    });
  });
});
