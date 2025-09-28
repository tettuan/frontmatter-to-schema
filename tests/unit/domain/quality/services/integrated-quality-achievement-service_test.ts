import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import {
  IntegratedQualityAchievementService,
  type QualityMetrics,
} from "../../../../../src/domain/quality/services/integrated-quality-achievement-service.ts";

/**
 * Unit Tests for IntegratedQualityAchievementService
 * Following robust testing principles with business logic protection
 *
 * Test Strategy:
 * - Core business logic validation (95% scoring system)
 * - Smart Constructor pattern validation
 * - Result<T,E> pattern compliance
 * - Domain boundary protection
 * - High-speed execution with isolation
 */

describe("IntegratedQualityAchievementService", () => {
  // Test Helpers - Reproducibility & Idempotency Guaranteed
  const createValidMetrics = (): QualityMetrics => ({
    totalityScore: 90,
    robustnessScore: 85,
    complexityScore: 88,
    testQualityScore: 92,
    dddBoundariesScore: 87,
  });

  const createExcellentMetrics = (): QualityMetrics => ({
    totalityScore: 98,
    robustnessScore: 96,
    complexityScore: 94,
    testQualityScore: 97,
    dddBoundariesScore: 95,
  });

  const createPoorMetrics = (): QualityMetrics => ({
    totalityScore: 45,
    robustnessScore: 50,
    complexityScore: 40,
    testQualityScore: 55,
    dddBoundariesScore: 48,
  });

  const createDefaultService = () => {
    const serviceResult = IntegratedQualityAchievementService.create();
    assert(serviceResult.ok, "Service creation should succeed with defaults");
    return serviceResult.data;
  };

  describe("Smart Constructor Validation", () => {
    it("should create service with default configuration successfully", () => {
      const result = IntegratedQualityAchievementService.create();

      assert(result.ok, "Default service creation should succeed");
      assertExists(result.data, "Service instance should be created");
      assertEquals(
        result.data.getTargetScore(),
        95.0,
        "Default target score should be 95%",
      );
    });

    it("should validate weight sum equals 1.0", () => {
      const invalidWeights = {
        weights: {
          totality: 0.30,
          robustness: 0.30,
          complexity: 0.20,
          testQuality: 0.20,
          dddBoundaries: 0.15, // Sum = 1.15 (invalid)
        },
      };

      const result = IntegratedQualityAchievementService.create(invalidWeights);

      assert(!result.ok, "Service creation should fail with invalid weights");
      assertEquals(result.error.kind, "ConfigurationError");
      assert(
        result.error.message.includes("must sum to 1.0"),
        "Error should mention weight sum requirement",
      );
    });

    it("should validate score range boundaries", () => {
      const invalidConfig = {
        targetScore: 150, // Invalid: > 100
        minimumPassingScore: -10, // Invalid: < 0
      };

      const result = IntegratedQualityAchievementService.create(invalidConfig);

      assert(
        !result.ok,
        "Service creation should fail with invalid score ranges",
      );
      assertEquals(result.error.kind, "ConfigurationError");
    });

    it("should accept valid custom configuration", () => {
      const customConfig = {
        targetScore: 90.0,
        minimumPassingScore: 75.0,
        weights: {
          totality: 0.30,
          robustness: 0.25,
          complexity: 0.20,
          testQuality: 0.15,
          dddBoundaries: 0.10,
        },
      };

      const result = IntegratedQualityAchievementService.create(customConfig);

      assert(
        result.ok,
        "Service creation should succeed with valid custom config",
      );
      assertEquals(
        result.data.getTargetScore(),
        90.0,
        "Custom target score should be applied",
      );
    });
  });

  describe("Quality Score Calculation - Core Business Logic", () => {
    it("should calculate weighted score correctly with excellent metrics", () => {
      const service = createDefaultService();
      const metrics = createExcellentMetrics();

      const result = service.calculateQualityScore(metrics);

      assert(result.ok, "Score calculation should succeed");
      const achievement = result.data;

      assertEquals(
        achievement.kind,
        "excellent",
        "Excellent metrics should achieve excellent rating",
      );
      assert(achievement.passedTarget, "Should pass target score");
      assert(achievement.score >= 95.0, "Score should meet target threshold");

      // Verify weighted calculation
      const expectedScore = 98 * 0.25 + // totality
        96 * 0.20 + // robustness
        94 * 0.20 + // complexity
        97 * 0.20 + // testQuality
        95 * 0.15; // dddBoundaries

      assertEquals(
        achievement.score,
        expectedScore,
        "Score should match weighted calculation",
      );
    });

    it("should classify good quality with improvement areas", () => {
      const service = createDefaultService();
      const metrics: QualityMetrics = {
        totalityScore: 82, // Below 85 threshold
        robustnessScore: 88, // Above threshold
        complexityScore: 84, // Below 85 threshold
        testQualityScore: 86, // Above threshold
        dddBoundariesScore: 83, // Below 85 threshold
      };

      const result = service.calculateQualityScore(metrics);

      assert(result.ok, "Score calculation should succeed");
      const achievement = result.data;

      assertEquals(
        achievement.kind,
        "good",
        "Valid metrics should achieve good rating",
      );
      assert(!achievement.passedTarget, "Should not pass target score");
      assert(
        achievement.score >= 80.0,
        "Score should be above minimum passing",
      );
      assert(achievement.score < 95.0, "Score should be below target");

      assert(
        "improvementAreas" in achievement &&
          achievement.improvementAreas.length > 0,
        "Should provide improvement areas",
      );
    });

    it("should identify critical issues with poor metrics", () => {
      const service = createDefaultService();
      const metrics = createPoorMetrics();

      const result = service.calculateQualityScore(metrics);

      assert(result.ok, "Score calculation should succeed");
      const achievement = result.data;

      assertEquals(
        achievement.kind,
        "needs-improvement",
        "Poor metrics should need improvement",
      );
      assert(!achievement.passedTarget, "Should not pass target score");
      assert(achievement.score < 80.0, "Score should be below minimum passing");

      assert(
        "criticalIssues" in achievement &&
          achievement.criticalIssues.length > 0,
        "Should identify critical issues",
      );

      // Verify critical issues contain CRITICAL prefix
      const criticalIssues = achievement.criticalIssues;
      assert(
        criticalIssues.some((issue) => issue.includes("CRITICAL:")),
        "Critical issues should have CRITICAL prefix",
      );
    });
  });

  describe("Input Validation - Totality Principle Compliance", () => {
    it("should validate metric value ranges", () => {
      const service = createDefaultService();
      const invalidMetrics = {
        ...createValidMetrics(),
        totalityScore: 150, // Invalid: > 100
      };

      const result = service.calculateQualityScore(invalidMetrics);

      assert(!result.ok, "Should reject invalid metric values");
      assertEquals(result.error.kind, "InvalidType");
      assert(
        result.error.message.includes("number between 0 and 100"),
        "Error should specify valid range",
      );
    });

    it("should validate metric data types", () => {
      const service = createDefaultService();
      const invalidMetrics = {
        ...createValidMetrics(),
        robustnessScore: "invalid" as any, // Invalid type
      };

      const result = service.calculateQualityScore(invalidMetrics);

      assert(!result.ok, "Should reject invalid data types");
      assertEquals(result.error.kind, "InvalidType");
    });

    it("should handle boundary values correctly", () => {
      const service = createDefaultService();
      const boundaryMetrics: QualityMetrics = {
        totalityScore: 0,
        robustnessScore: 100,
        complexityScore: 50,
        testQualityScore: 0,
        dddBoundariesScore: 100,
      };

      const result = service.calculateQualityScore(boundaryMetrics);

      assert(result.ok, "Should handle boundary values successfully");
      assertExists(result.data, "Should return valid result");
    });
  });

  describe("Improvement Area Identification", () => {
    it("should identify specific improvement areas below threshold", () => {
      const service = createDefaultService();
      const metrics: QualityMetrics = {
        totalityScore: 80, // Below 85 threshold
        robustnessScore: 90, // Above threshold
        complexityScore: 82, // Below threshold
        testQualityScore: 88, // Above threshold
        dddBoundariesScore: 75, // Below threshold
      };

      const result = service.calculateQualityScore(metrics);

      assert(result.ok, "Score calculation should succeed");
      const achievement = result.data;

      if (achievement.kind === "good") {
        const improvements = achievement.improvementAreas;
        assert(improvements.length > 0, "Should identify improvement areas");

        // Check specific improvement recommendations
        assert(
          improvements.some((area) => area.includes("Result<T,E>")),
          "Should recommend totality improvements",
        );
        assert(
          improvements.some((area) => area.includes("complexity control")),
          "Should recommend complexity improvements",
        );
        assert(
          improvements.some((area) => area.includes("domain boundary")),
          "Should recommend DDD boundary improvements",
        );
      }
    });

    it("should provide no improvement areas for excellent scores", () => {
      const service = createDefaultService();
      const metrics = createExcellentMetrics();

      const result = service.calculateQualityScore(metrics);

      assert(result.ok, "Score calculation should succeed");
      const achievement = result.data;

      assertEquals(achievement.kind, "excellent", "Should be excellent");
      // Excellent achievements don't have improvementAreas property
      assert(
        !("improvementAreas" in achievement),
        "Excellent should not have improvement areas",
      );
    });
  });

  describe("Critical Issue Detection", () => {
    it("should identify critical issues below critical threshold", () => {
      const service = createDefaultService();
      const criticalMetrics: QualityMetrics = {
        totalityScore: 45, // Below 60 critical threshold
        robustnessScore: 55, // Below critical threshold
        complexityScore: 30, // Below critical threshold
        testQualityScore: 65, // Above critical threshold
        dddBoundariesScore: 50, // Below critical threshold
      };

      const result = service.calculateQualityScore(criticalMetrics);

      assert(result.ok, "Score calculation should succeed");
      const achievement = result.data;

      assertEquals(
        achievement.kind,
        "needs-improvement",
        "Should need improvement",
      );

      if (achievement.kind === "needs-improvement") {
        const issues = achievement.criticalIssues;
        assert(issues.length >= 4, "Should identify multiple critical issues");

        // Verify specific critical issue types
        assert(
          issues.some((issue) =>
            issue.includes("Totality principle violations")
          ),
          "Should identify totality critical issues",
        );
        assert(
          issues.some((issue) =>
            issue.includes("Complexity management failure")
          ),
          "Should identify complexity critical issues",
        );
        assert(
          issues.some((issue) => issue.includes("DDD boundary violations")),
          "Should identify DDD critical issues",
        );
      }
    });
  });

  describe("Configuration Management", () => {
    it("should return current configuration correctly", () => {
      const customConfig = {
        targetScore: 88.0,
        minimumPassingScore: 70.0,
        weights: {
          totality: 0.35,
          robustness: 0.25,
          complexity: 0.15,
          testQuality: 0.15,
          dddBoundaries: 0.10,
        },
      };

      const serviceResult = IntegratedQualityAchievementService.create(
        customConfig,
      );
      assert(serviceResult.ok, "Service creation should succeed");

      const service = serviceResult.data;
      const config = service.getConfiguration();

      assertEquals(
        config.targetScore,
        88.0,
        "Should return correct target score",
      );
      assertEquals(
        config.minimumPassingScore,
        70.0,
        "Should return correct minimum score",
      );
      assertEquals(
        config.weights.totality,
        0.35,
        "Should return correct totality weight",
      );
    });

    it("should maintain immutable configuration", () => {
      const service = createDefaultService();
      const config1 = service.getConfiguration();
      const config2 = service.getConfiguration();

      // Configurations should be deeply equal but different objects
      assertEquals(config1.targetScore, config2.targetScore);
      assertEquals(config1.minimumPassingScore, config2.minimumPassingScore);

      // Verify immutability by attempting modification
      try {
        (config1 as any).targetScore = 50; // Should fail in strict mode
      } catch {
        // Expected in strict mode
      }

      // Original service should remain unchanged
      assertEquals(service.getTargetScore(), 95.0);
    });
  });

  describe("Error Handling Robustness", () => {
    it("should handle NaN values in metrics gracefully", () => {
      const service = createDefaultService();
      const nanMetrics = {
        ...createValidMetrics(),
        totalityScore: NaN,
      };

      const result = service.calculateQualityScore(nanMetrics);

      assert(!result.ok, "Should reject NaN values");
      assertEquals(result.error.kind, "InvalidType");
    });

    it("should handle Infinity values in metrics gracefully", () => {
      const service = createDefaultService();
      const infinityMetrics = {
        ...createValidMetrics(),
        robustnessScore: Infinity,
      };

      const result = service.calculateQualityScore(infinityMetrics);

      assert(!result.ok, "Should reject Infinity values");
      assertEquals(result.error.kind, "InvalidType");
    });

    it("should handle negative values in metrics gracefully", () => {
      const service = createDefaultService();
      const negativeMetrics = {
        ...createValidMetrics(),
        complexityScore: -5,
      };

      const result = service.calculateQualityScore(negativeMetrics);

      assert(!result.ok, "Should reject negative values");
      assertEquals(result.error.kind, "InvalidType");
    });
  });
});
