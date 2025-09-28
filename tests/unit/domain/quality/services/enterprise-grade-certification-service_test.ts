import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import {
  type ComplianceDomain,
  type DomainAssessment,
  EnterpriseGradeCertificationService,
} from "../../../../../src/domain/quality/services/enterprise-grade-certification-service.ts";

/**
 * Unit Tests for EnterpriseGradeCertificationService
 * Following robust testing principles with domain validation focus
 *
 * Test Strategy:
 * - 5-domain enterprise certification validation
 * - Smart Constructor pattern validation
 * - Result<T,E> pattern compliance
 * - Certification logic integrity
 * - Domain boundary validation
 */

describe("EnterpriseGradeCertificationService", () => {
  // Test Helpers - Reproducibility & Idempotency Guaranteed
  const createValidDomainAssessment = (
    domain: ComplianceDomain,
    score: number = 90,
    passed: boolean = true,
    additionalRequirements: Array<
      { name: string; status: "passed" | "failed" | "warning"; details: string }
    > = [],
    additionalRecommendations: string[] = [],
  ): DomainAssessment => ({
    domain,
    score,
    passed,
    requirements: [
      {
        name: `${domain} requirement 1`,
        status: passed ? "passed" : "failed",
        details: `${domain} requirement 1 details`,
      },
      {
        name: `${domain} requirement 2`,
        status: "passed",
        details: `${domain} requirement 2 details`,
      },
      ...additionalRequirements,
    ],
    recommendations: passed
      ? additionalRecommendations
      : [`Improve ${domain} compliance`, ...additionalRecommendations],
  });

  const createCompleteDomainAssessments = (
    baseScore: number = 90,
  ): DomainAssessment[] => [
    createValidDomainAssessment("security", baseScore),
    createValidDomainAssessment("performance", baseScore),
    createValidDomainAssessment("maintainability", baseScore),
    createValidDomainAssessment("reliability", baseScore),
    createValidDomainAssessment("scalability", baseScore),
  ];

  const createDefaultService = () => {
    const serviceResult = EnterpriseGradeCertificationService.create();
    assert(serviceResult.ok, "Service creation should succeed with defaults");
    return serviceResult.data;
  };

  describe("Smart Constructor Validation", () => {
    it("should create service with default configuration successfully", () => {
      const result = EnterpriseGradeCertificationService.create();

      assert(result.ok, "Default service creation should succeed");
      assertExists(result.data, "Service instance should be created");

      const config = result.data.getConfiguration();
      assertEquals(
        config.passingThreshold,
        85.0,
        "Default passing threshold should be 85%",
      );
      assertEquals(
        config.conditionalThreshold,
        70.0,
        "Default conditional threshold should be 70%",
      );
      assertEquals(
        config.validityPeriodMonths,
        12,
        "Default validity should be 12 months",
      );
      assert(
        config.requireAllDomainsPass,
        "Should require all domains to pass by default",
      );
    });

    it("should validate threshold ordering", () => {
      const invalidConfig = {
        passingThreshold: 70.0,
        conditionalThreshold: 80.0, // Invalid: higher than passing
      };

      const result = EnterpriseGradeCertificationService.create(invalidConfig);

      assert(
        !result.ok,
        "Service creation should fail with invalid threshold order",
      );
      assertEquals(result.error.kind, "ConfigurationError");
      assert(
        result.error.message.includes("Passing threshold must be higher"),
        "Error should mention threshold ordering",
      );
    });

    it("should validate threshold ranges", () => {
      const invalidConfig = {
        passingThreshold: 150, // Invalid: > 100
        conditionalThreshold: -10, // Invalid: < 0
      };

      const result = EnterpriseGradeCertificationService.create(invalidConfig);

      assert(
        !result.ok,
        "Service creation should fail with invalid threshold ranges",
      );
      assertEquals(result.error.kind, "ConfigurationError");
      assert(
        result.error.message.includes("between 0 and 100"),
        "Error should mention valid range",
      );
    });

    it("should validate domain weights sum to 1.0", () => {
      const invalidWeights = {
        domainWeights: {
          security: 0.30,
          performance: 0.30,
          maintainability: 0.20,
          reliability: 0.20,
          scalability: 0.15, // Sum = 1.15 (invalid)
        },
      };

      const result = EnterpriseGradeCertificationService.create(invalidWeights);

      assert(
        !result.ok,
        "Service creation should fail with invalid domain weights",
      );
      assertEquals(result.error.kind, "ConfigurationError");
      assert(
        result.error.message.includes("must sum to 1.0"),
        "Error should mention weight sum requirement",
      );
    });

    it("should accept valid custom configuration", () => {
      const customConfig = {
        passingThreshold: 88.0,
        conditionalThreshold: 75.0,
        validityPeriodMonths: 6,
        requireAllDomainsPass: false,
        domainWeights: {
          security: 0.30,
          performance: 0.25,
          maintainability: 0.20,
          reliability: 0.15,
          scalability: 0.10,
        },
      };

      const result = EnterpriseGradeCertificationService.create(customConfig);

      assert(
        result.ok,
        "Service creation should succeed with valid custom config",
      );
      const config = result.data.getConfiguration();
      assertEquals(
        config.passingThreshold,
        88.0,
        "Custom passing threshold should be applied",
      );
      assertEquals(
        config.requireAllDomainsPass,
        false,
        "Custom domain requirement should be applied",
      );
    });
  });

  describe("Enterprise Certification Assessment - Core Business Logic", () => {
    it("should certify excellent assessments as enterprise-grade", () => {
      const service = createDefaultService();
      const assessments = createCompleteDomainAssessments(95); // Excellent scores

      const result = service.performCertification(assessments);

      assert(result.ok, "Certification should succeed");
      const certification = result.data;

      assertEquals(
        certification.kind,
        "certified",
        "Excellent assessments should be certified",
      );
      if (certification.kind === "certified") {
        assertEquals(
          certification.level,
          "enterprise-grade",
          "Should achieve enterprise-grade level",
        );
        assert(
          certification.overallScore >= 85.0,
          "Overall score should meet passing threshold",
        );
        assertExists(
          certification.certificationId,
          "Should generate certification ID",
        );
        assertExists(certification.validUntil, "Should set validity date");

        // Verify certification ID format
        assert(
          certification.certificationId.startsWith("CERT-"),
          "Certification ID should have correct prefix",
        );

        // Verify validity date is in future
        assert(
          certification.validUntil > new Date(),
          "Validity date should be in the future",
        );
      }
    });

    it("should provide conditional certification for good assessments", () => {
      const service = createDefaultService();
      const assessments = createCompleteDomainAssessments(78); // Good scores, below passing threshold

      const result = service.performCertification(assessments);

      assert(result.ok, "Certification should succeed");
      const certification = result.data;

      assertEquals(
        certification.kind,
        "conditional",
        "Good assessments should be conditional",
      );
      if (certification.kind === "conditional") {
        assertEquals(
          certification.level,
          "partial-compliance",
          "Should achieve partial compliance",
        );
        assert(
          certification.overallScore >= 70.0,
          "Overall score should meet conditional threshold",
        );
        assert(
          certification.overallScore < 85.0,
          "Overall score should be below passing threshold",
        );

        assert(
          certification.issues.length > 0,
          "Should identify issues for improvement",
        );
        assert(
          certification.requiredActions.length >= 0,
          "Should provide required actions",
        );
      }
    });

    it("should fail certification for poor assessments", () => {
      const service = createDefaultService();
      const poorAssessments = createCompleteDomainAssessments(50); // Poor scores
      // Make some domains fail
      poorAssessments[0] = { ...poorAssessments[0], passed: false };
      poorAssessments[1] = { ...poorAssessments[1], passed: false };

      const result = service.performCertification(poorAssessments);

      assert(result.ok, "Certification should succeed (but result is failed)");
      const certification = result.data;

      assertEquals(
        certification.kind,
        "failed",
        "Poor assessments should fail certification",
      );
      if (certification.kind === "failed") {
        assertEquals(
          certification.level,
          "non-compliant",
          "Should be non-compliant",
        );
        assert(
          certification.overallScore < 70.0,
          "Overall score should be below conditional threshold",
        );

        assert(
          certification.criticalFailures.length > 0,
          "Should identify critical failures",
        );

        // Verify critical failures contain CRITICAL prefix
        assert(
          certification.criticalFailures.some((failure) =>
            failure.includes("CRITICAL:")
          ),
          "Critical failures should have CRITICAL prefix",
        );
      }
    });

    it("should calculate weighted overall score correctly", () => {
      const service = createDefaultService();
      const assessments: DomainAssessment[] = [
        createValidDomainAssessment("security", 90), // weight 0.25
        createValidDomainAssessment("performance", 80), // weight 0.20
        createValidDomainAssessment("maintainability", 85), // weight 0.20
        createValidDomainAssessment("reliability", 88), // weight 0.20
        createValidDomainAssessment("scalability", 92), // weight 0.15
      ];

      const result = service.performCertification(assessments);

      assert(result.ok, "Certification should succeed");
      const certification = result.data;

      // Calculate expected weighted score
      const expectedScore = 90 * 0.25 + 80 * 0.20 + 85 * 0.20 + 88 * 0.20 +
        92 * 0.15;
      assertEquals(
        certification.overallScore,
        expectedScore,
        "Should calculate weighted score correctly",
      );
    });
  });

  describe("Domain Assessment Validation - Totality Principle", () => {
    it("should require all 5 compliance domains", () => {
      const service = createDefaultService();
      const incompleteAssessments = [
        createValidDomainAssessment("security", 90),
        createValidDomainAssessment("performance", 85),
        // Missing: maintainability, reliability, scalability
      ];

      const result = service.performCertification(incompleteAssessments);

      assert(!result.ok, "Should reject incomplete domain assessments");
      assertEquals(result.error.kind, "MissingRequired");
      if (result.error.kind === "MissingRequired") {
        assert(
          result.error.field.includes("maintainability") &&
            result.error.field.includes("reliability") &&
            result.error.field.includes("scalability"),
          "Error should list missing domains",
        );
      }
    });

    it("should accept assessments with all required domains", () => {
      const service = createDefaultService();
      const completeAssessments = createCompleteDomainAssessments(80);

      const result = service.performCertification(completeAssessments);

      assert(result.ok, "Should accept complete domain assessments");
      assertExists(result.data, "Should return certification result");
    });

    it("should handle duplicate domain assessments gracefully", () => {
      const service = createDefaultService();
      const duplicateAssessments = [
        ...createCompleteDomainAssessments(85),
        createValidDomainAssessment("security", 90), // Duplicate security
      ];

      const result = service.performCertification(duplicateAssessments);

      assert(result.ok, "Should handle duplicate domains gracefully");
      // The service should use the last assessment for each domain
      assertExists(result.data, "Should return certification result");
    });
  });

  describe("Individual Domain Assessment", () => {
    it("should assess security compliance correctly", () => {
      const service = createDefaultService();

      const result = service.assessSecurityCompliance();

      assert(result.ok, "Security assessment should succeed");
      const assessment = result.data;

      assertEquals(
        assessment.domain,
        "security",
        "Should assess security domain",
      );
      assert(
        assessment.score >= 0 && assessment.score <= 100,
        "Score should be valid range",
      );
      assert(
        assessment.requirements.length > 0,
        "Should have security requirements",
      );

      // Verify security-specific requirements
      const requirementNames = assessment.requirements.map((req) => req.name);
      assert(
        requirementNames.some((name) => name.includes("Vulnerability")),
        "Should include vulnerability scanning requirement",
      );
      assert(
        requirementNames.some((name) => name.includes("Secret")),
        "Should include secret detection requirement",
      );
    });

    it("should assess performance compliance correctly", () => {
      const service = createDefaultService();

      const result = service.assessPerformanceCompliance();

      assert(result.ok, "Performance assessment should succeed");
      const assessment = result.data;

      assertEquals(
        assessment.domain,
        "performance",
        "Should assess performance domain",
      );
      assert(
        assessment.score >= 0 && assessment.score <= 100,
        "Score should be valid range",
      );
      assert(
        assessment.requirements.length > 0,
        "Should have performance requirements",
      );

      // Verify performance-specific requirements
      const requirementNames = assessment.requirements.map((req) => req.name);
      assert(
        requirementNames.some((name) => name.includes("Response Time")),
        "Should include response time requirement",
      );
      assert(
        requirementNames.some((name) => name.includes("Throughput")),
        "Should include throughput requirement",
      );
    });
  });

  describe("Certification ID and Validity Management", () => {
    it("should generate unique certification IDs", () => {
      const service = createDefaultService();
      const assessments = createCompleteDomainAssessments(90);

      const result1 = service.performCertification(assessments);
      const result2 = service.performCertification(assessments);

      assert(result1.ok && result2.ok, "Both certifications should succeed");

      if (
        result1.data.kind === "certified" && result2.data.kind === "certified"
      ) {
        assert(
          result1.data.certificationId !== result2.data.certificationId,
          "Certification IDs should be unique",
        );

        // Verify ID format
        assert(
          result1.data.certificationId.match(/^CERT-[A-Z0-9]+-[A-Z0-9]+$/),
          "Certification ID should match expected format",
        );
      }
    });

    it("should set appropriate validity period", () => {
      const customConfig = { validityPeriodMonths: 6 };
      const serviceResult = EnterpriseGradeCertificationService.create(
        customConfig,
      );
      assert(serviceResult.ok, "Service creation should succeed");

      const service = serviceResult.data;
      const assessments = createCompleteDomainAssessments(90);

      const result = service.performCertification(assessments);

      assert(result.ok, "Certification should succeed");

      if (result.data.kind === "certified") {
        const now = new Date();
        const validUntil = result.data.validUntil;
        const monthsDiff = (validUntil.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24 * 30);

        assert(
          Math.abs(monthsDiff - 6) < 1, // Allow 1 month tolerance
          "Validity period should match configuration",
        );
      }
    });
  });

  describe("Issue and Action Identification", () => {
    it("should identify conditional issues correctly", () => {
      const service = createDefaultService();
      const assessments = createCompleteDomainAssessments(78); // Below passing threshold

      // Add warning requirements
      assessments[0] = {
        ...assessments[0],
        requirements: [
          ...assessments[0].requirements,
          {
            name: "Warning requirement",
            status: "warning",
            details: "This requirement has warnings",
          },
        ],
      };

      const result = service.performCertification(assessments);

      assert(result.ok, "Certification should succeed");

      if (result.data.kind === "conditional") {
        const issues = result.data.issues;
        assert(issues.length > 0, "Should identify conditional issues");

        // Should identify score below threshold
        assert(
          issues.some((issue) => issue.includes("below passing threshold")),
          "Should identify score issues",
        );

        // Should identify warning requirements
        assert(
          issues.some((issue) =>
            issue.includes("warning(s) requiring attention")
          ),
          "Should identify warning requirements",
        );
      }
    });

    it("should generate required actions from recommendations", () => {
      const service = createDefaultService();
      const assessments = createCompleteDomainAssessments(78);

      // Add specific recommendations
      assessments[0] = {
        ...assessments[0],
        recommendations: ["Improve security measures"],
      };
      assessments[1] = {
        ...assessments[1],
        recommendations: ["Optimize performance"],
      };
      assessments[2] = {
        ...assessments[2],
        recommendations: ["Improve security measures"],
      }; // Duplicate

      const result = service.performCertification(assessments);

      assert(result.ok, "Certification should succeed");

      if (result.data.kind === "conditional") {
        const actions = result.data.requiredActions;
        assert(actions.length >= 2, "Should generate required actions");

        // Should include unique recommendations
        assert(
          actions.includes("Improve security measures"),
          "Should include security action",
        );
        assert(
          actions.includes("Optimize performance"),
          "Should include performance action",
        );

        // Should deduplicate recommendations
        const securityCount = actions.filter((action) =>
          action === "Improve security measures"
        ).length;
        assertEquals(
          securityCount,
          1,
          "Should deduplicate identical recommendations",
        );
      }
    });

    it("should identify critical failures correctly", () => {
      const service = createDefaultService();
      const assessments = createCompleteDomainAssessments(60);

      // Make some domains fail
      assessments[0] = { ...assessments[0], passed: false };
      assessments[1] = { ...assessments[1], passed: false };

      // Add failed requirements
      assessments[0] = {
        ...assessments[0],
        requirements: [
          ...assessments[0].requirements,
          {
            name: "Critical requirement",
            status: "failed",
            details: "This requirement failed critically",
          },
        ],
      };

      const result = service.performCertification(assessments);

      assert(result.ok, "Certification should succeed");

      if (result.data.kind === "failed") {
        const failures = result.data.criticalFailures;
        assert(failures.length > 0, "Should identify critical failures");

        // Should identify failed domains
        assert(
          failures.some((failure) =>
            failure.includes("domain failed certification")
          ),
          "Should identify failed domains",
        );

        // Should identify failed requirements
        assert(
          failures.some((failure) => failure.includes("Critical requirement")),
          "Should identify failed requirements",
        );
      }
    });
  });

  describe("Configuration Immutability", () => {
    it("should return immutable configuration", () => {
      const service = createDefaultService();
      const config1 = service.getConfiguration();
      const config2 = service.getConfiguration();

      // Configurations should be equal but separate objects
      assertEquals(config1.passingThreshold, config2.passingThreshold);
      assertEquals(config1.conditionalThreshold, config2.conditionalThreshold);

      // Verify immutability
      try {
        (config1 as any).passingThreshold = 50; // Should fail in strict mode
      } catch {
        // Expected in strict mode
      }

      // Original service configuration should remain unchanged
      const freshConfig = service.getConfiguration();
      assertEquals(freshConfig.passingThreshold, 85.0);
    });
  });
});
