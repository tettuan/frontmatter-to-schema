import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { ComplexityMetricsService } from "./complexity-metrics-service.ts";

describe("ComplexityMetricsService", () => {
  describe("Smart Constructor", () => {
    it("should create service with default configuration", () => {
      const result = ComplexityMetricsService.create();
      assertEquals(result.ok, true);
    });

    it("should create service with custom weights", () => {
      const result = ComplexityMetricsService.create({
        fileCountWeight: 1.0,
        schemaWeight: 3.0,
        templateWeight: 2.0,
      });
      assertEquals(result.ok, true);
    });

    it("should reject negative weights", () => {
      const result = ComplexityMetricsService.create({
        fileCountWeight: -1.0,
      });
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
      }
    });

    it("should reject all-zero weights", () => {
      const result = ComplexityMetricsService.create({
        fileCountWeight: 0,
        schemaWeight: 0,
        templateWeight: 0,
        aggregationWeight: 0,
        parallelismWeight: 0,
        errorHandlingWeight: 0,
        stateSpaceWeight: 0,
        integrationWeight: 0,
      });
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assert(result.error.message.includes("At least one"));
      }
    });
  });

  describe("Get Complexity Factors", () => {
    it("should return default factors when no state provided", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors = service.getComplexityFactors();

      assertEquals(factors.fileCount, 10);
      assertEquals(factors.schemaComplexity, 5);
      assertEquals(factors.templateComplexity, 3);
      assert(factors.parallelismLevel >= 0);
    });

    it("should merge provided state with defaults", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const factors = service.getComplexityFactors({
        fileCount: 50,
        schemaComplexity: 15,
      });

      assertEquals(factors.fileCount, 50);
      assertEquals(factors.schemaComplexity, 15);
      assertEquals(factors.templateComplexity, 3); // Default
    });
  });

  describe("Calculate Exhaustiveness", () => {
    it("should calculate perfect exhaustiveness", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateExhaustiveness({
        totalFunctions: 100,
        resultTypeFunctions: 100,
        totalSwitchStatements: 20,
        exhaustiveSwitchStatements: 20,
        totalConstructors: 10,
        smartConstructors: 10,
        totalUnions: 15,
        discriminatedUnions: 15,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.coveragePercentage, 100);
        assertEquals(result.data.resultTypeUsage, 100);
        assertEquals(result.data.smartConstructorUsage, 100);
      }
    });

    it("should calculate partial exhaustiveness", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateExhaustiveness({
        totalFunctions: 100,
        resultTypeFunctions: 50,
        totalSwitchStatements: 20,
        exhaustiveSwitchStatements: 10,
        totalConstructors: 10,
        smartConstructors: 5,
        totalUnions: 15,
        discriminatedUnions: 8,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assert(result.data.coveragePercentage > 0);
        assert(result.data.coveragePercentage < 100);
        assertEquals(result.data.resultTypeUsage, 50);
      }
    });

    it("should reject negative metrics", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateExhaustiveness({
        totalFunctions: -1,
        resultTypeFunctions: 0,
        totalSwitchStatements: 0,
        exhaustiveSwitchStatements: 0,
        totalConstructors: 0,
        smartConstructors: 0,
        totalUnions: 0,
        discriminatedUnions: 0,
      });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidType");
      }
    });

    it("should reject invalid ratios", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateExhaustiveness({
        totalFunctions: 50,
        resultTypeFunctions: 60, // More than total!
        totalSwitchStatements: 20,
        exhaustiveSwitchStatements: 10,
        totalConstructors: 10,
        smartConstructors: 5,
        totalUnions: 15,
        discriminatedUnions: 8,
      });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidStructure");
      }
    });
  });

  describe("Calculate Integrated Control", () => {
    it("should calculate perfect control metrics", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateIntegratedControl({
        totalHardcodedValues: 0,
        externalizedConfigs: 50,
        totalErrorPaths: 100,
        handledErrorPaths: 100,
        totalStateTransitions: 30,
        validatedTransitions: 30,
        totalDomainCalls: 200,
        properDomainCalls: 200,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.hardcodingElimination, 100);
        assertEquals(result.data.errorHandlingCompleteness, 100);
        assertEquals(result.data.stateTransitionValidation, 100);
        assertEquals(result.data.domainBoundaryRespect, 100);
      }
    });

    it("should calculate partial control metrics", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateIntegratedControl({
        totalHardcodedValues: 5,
        externalizedConfigs: 45,
        totalErrorPaths: 100,
        handledErrorPaths: 80,
        totalStateTransitions: 30,
        validatedTransitions: 20,
        totalDomainCalls: 200,
        properDomainCalls: 150,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assert(result.data.hardcodingElimination < 100);
        assertEquals(result.data.errorHandlingCompleteness, 80);
        assert(result.data.stateTransitionValidation < 100);
        assertEquals(result.data.domainBoundaryRespect, 75);
      }
    });

    it("should reject negative system metrics", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateIntegratedControl({
        totalHardcodedValues: -1,
        externalizedConfigs: 0,
        totalErrorPaths: 0,
        handledErrorPaths: 0,
        totalStateTransitions: 0,
        validatedTransitions: 0,
        totalDomainCalls: 0,
        properDomainCalls: 0,
      });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidType");
      }
    });
  });

  describe("Calculate Complexity Score", () => {
    it("should calculate low complexity score", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateComplexityScore({
        fileCount: 5,
        schemaComplexity: 2,
        templateComplexity: 1,
        aggregationComplexity: 1,
        parallelismLevel: 1,
        errorHandlingComplexity: 2,
        stateSpaceSize: 10,
        integrationPoints: 1,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assert(result.data >= 0);
        assert(result.data <= 100);
        assert(result.data < 20); // Should be low
      }
    });

    it("should calculate high complexity score", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateComplexityScore({
        fileCount: 100,
        schemaComplexity: 50,
        templateComplexity: 40,
        aggregationComplexity: 30,
        parallelismLevel: 10,
        errorHandlingComplexity: 25,
        stateSpaceSize: 100,
        integrationPoints: 20,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assert(result.data >= 0);
        assert(result.data <= 100);
        assert(result.data > 30); // Should be high (>30 for these factors)
      }
    });

    it("should reject negative complexity factors", () => {
      const serviceResult = ComplexityMetricsService.create();
      assert(serviceResult.ok);
      if (!serviceResult.ok) return;

      const service = serviceResult.data;
      const result = service.calculateComplexityScore({
        fileCount: -1,
        schemaComplexity: 2,
        templateComplexity: 1,
        aggregationComplexity: 1,
        parallelismLevel: 1,
        errorHandlingComplexity: 2,
        stateSpaceSize: 10,
        integrationPoints: 1,
      });

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidType");
      }
    });
  });
});
