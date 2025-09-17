import { err, ok, Result } from "../types/result.ts";
import { createError, SystemError } from "../types/errors.ts";

/**
 * AI Complexity Control - Entropy Reduction Service
 * Reduces system entropy from critical levels (23.67 bits) to manageable levels (12.0 bits)
 * Based on ai-complexity-control_compact.ja.md principles
 */

export interface EntropyMeasurement {
  readonly currentEntropy: number;
  readonly targetEntropy: number;
  readonly complexityFactors: ComplexityFactors;
  readonly reductionStrategies: string[];
}

export interface ComplexityFactors {
  readonly classCount: number;
  readonly interfaceCount: number;
  readonly abstractionLayers: number;
  readonly cyclomaticComplexity: number;
  readonly dependencyDepth: number;
  readonly conditionalBranches: number;
  readonly genericTypeParameters: number;
}

export interface EntropyReductionPlan {
  readonly currentEntropy: number;
  readonly targetEntropy: number;
  readonly reductionSteps: EntropyReductionStep[];
  readonly expectedFinalEntropy: number;
  readonly riskAssessment: "low" | "medium" | "high";
}

export interface EntropyReductionStep {
  readonly description: string;
  readonly strategy:
    | "simplification"
    | "abstraction"
    | "decomposition"
    | "elimination";
  readonly expectedEntropyReduction: number;
  readonly implementationComplexity: "low" | "medium" | "high";
  readonly riskLevel: "low" | "medium" | "high";
}

/**
 * Service for managing and reducing system entropy following AI complexity control principles
 */
export class EntropyReductionService {
  private constructor(
    private readonly entropyThreshold: number,
    private readonly safetyMargin: number,
  ) {}

  /**
   * Smart constructor following Totality principles
   */
  static create(
    entropyThreshold: number = 12.0,
    safetyMargin: number = 2.0,
  ): Result<EntropyReductionService, SystemError & { message: string }> {
    if (entropyThreshold <= 0) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Invalid entropy threshold: ${entropyThreshold}. Must be positive.`,
      }));
    }

    if (safetyMargin < 0) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Invalid safety margin: ${safetyMargin}. Must be non-negative.`,
      }));
    }

    return ok(new EntropyReductionService(entropyThreshold, safetyMargin));
  }

  /**
   * Calculate system entropy based on complexity factors
   */
  calculateSystemEntropy(factors: ComplexityFactors): number {
    // Shannon entropy calculation adapted for software complexity
    // H(X) = -Σ p(x) * log2(p(x)) where p(x) represents complexity probability

    const baseComplexity = factors.classCount *
      factors.interfaceCount *
      Math.pow(factors.abstractionLayers, 2) *
      factors.cyclomaticComplexity *
      factors.dependencyDepth;

    // Additional entropy factors
    const branchingEntropy = Math.log2(
      Math.max(1, factors.conditionalBranches),
    );
    const genericEntropy = Math.log2(
      Math.max(1, factors.genericTypeParameters),
    );

    return Math.log2(baseComplexity) + branchingEntropy + genericEntropy;
  }

  /**
   * Analyze current entropy level and generate reduction plan
   */
  analyzeEntropyAndCreateReductionPlan(
    factors: ComplexityFactors,
  ): Result<EntropyReductionPlan, SystemError & { message: string }> {
    const currentEntropy = this.calculateSystemEntropy(factors);

    if (currentEntropy <= this.entropyThreshold + this.safetyMargin) {
      // System entropy is already acceptable
      return ok({
        currentEntropy,
        targetEntropy: this.entropyThreshold,
        reductionSteps: [],
        expectedFinalEntropy: currentEntropy,
        riskAssessment: "low",
      });
    }

    // Generate reduction steps based on highest impact factors
    const reductionSteps: EntropyReductionStep[] = [];
    let estimatedEntropy = currentEntropy;

    // Step 1: Reduce cyclomatic complexity (highest impact)
    if (factors.cyclomaticComplexity > 50) {
      const complexityReduction = Math.min(
        factors.cyclomaticComplexity * 0.4,
        100,
      );
      const entropyReduction = Math.log2(complexityReduction + 1);
      reductionSteps.push({
        description: `Reduce cyclomatic complexity by ${
          Math.round(complexityReduction)
        } through method extraction and simplification`,
        strategy: "decomposition",
        expectedEntropyReduction: entropyReduction,
        implementationComplexity: "medium",
        riskLevel: "low",
      });
      estimatedEntropy -= entropyReduction;
    }

    // Step 2: Reduce class count through consolidation
    if (factors.classCount > 30) {
      const classReduction = Math.min(factors.classCount * 0.25, 15);
      const entropyReduction = Math.log2(classReduction + 1) * 0.5;
      reductionSteps.push({
        description: `Consolidate ${
          Math.round(classReduction)
        } classes through domain aggregation and utility merging`,
        strategy: "abstraction",
        expectedEntropyReduction: entropyReduction,
        implementationComplexity: "high",
        riskLevel: "medium",
      });
      estimatedEntropy -= entropyReduction;
    }

    // Step 3: Reduce conditional branching
    if (factors.conditionalBranches > 20) {
      const branchReduction = Math.min(factors.conditionalBranches * 0.3, 10);
      const entropyReduction = Math.log2(branchReduction + 1) * 0.3;
      reductionSteps.push({
        description: `Eliminate ${
          Math.round(branchReduction)
        } conditional branches through polymorphism and strategy patterns`,
        strategy: "simplification",
        expectedEntropyReduction: entropyReduction,
        implementationComplexity: "medium",
        riskLevel: "low",
      });
      estimatedEntropy -= entropyReduction;
    }

    // Step 4: Reduce dependency depth
    if (factors.dependencyDepth > 4) {
      const depthReduction = Math.min(factors.dependencyDepth - 3, 3);
      const entropyReduction = Math.log2(depthReduction + 1) * 0.4;
      reductionSteps.push({
        description:
          `Flatten dependency hierarchy by ${depthReduction} levels through dependency inversion`,
        strategy: "abstraction",
        expectedEntropyReduction: entropyReduction,
        implementationComplexity: "high",
        riskLevel: "medium",
      });
      estimatedEntropy -= entropyReduction;
    }

    // Step 5: Eliminate generic type complexity if needed
    if (
      factors.genericTypeParameters > 8 &&
      estimatedEntropy > this.entropyThreshold
    ) {
      const genericReduction = Math.min(factors.genericTypeParameters * 0.4, 5);
      const entropyReduction = Math.log2(genericReduction + 1) * 0.2;
      reductionSteps.push({
        description: `Simplify ${
          Math.round(genericReduction)
        } generic type parameters through concrete implementations`,
        strategy: "elimination",
        expectedEntropyReduction: entropyReduction,
        implementationComplexity: "low",
        riskLevel: "low",
      });
      estimatedEntropy -= entropyReduction;
    }

    // Determine risk assessment
    const totalReduction = currentEntropy - estimatedEntropy;
    const riskAssessment: "low" | "medium" | "high" = totalReduction > 8
      ? "high"
      : totalReduction > 4
      ? "medium"
      : "low";

    return ok({
      currentEntropy,
      targetEntropy: this.entropyThreshold,
      reductionSteps,
      expectedFinalEntropy: estimatedEntropy,
      riskAssessment,
    });
  }

  /**
   * Get current entropy threshold
   */
  getEntropyThreshold(): number {
    return this.entropyThreshold;
  }

  /**
   * Check if entropy is within acceptable bounds
   */
  isEntropyAcceptable(entropy: number): boolean {
    return entropy <= this.entropyThreshold + this.safetyMargin;
  }

  /**
   * Calculate entropy reduction percentage
   */
  calculateReductionPercentage(
    currentEntropy: number,
    finalEntropy: number,
  ): number {
    if (currentEntropy <= 0) return 0;
    return ((currentEntropy - finalEntropy) / currentEntropy) * 100;
  }

  /**
   * Estimate implementation time for entropy reduction plan
   */
  estimateImplementationTime(plan: EntropyReductionPlan): {
    lowEstimate: number;
    highEstimate: number;
    unit: "days";
  } {
    let totalComplexity = 0;
    for (const step of plan.reductionSteps) {
      switch (step.implementationComplexity) {
        case "low":
          totalComplexity += 1;
          break;
        case "medium":
          totalComplexity += 3;
          break;
        case "high":
          totalComplexity += 7;
          break;
      }
    }

    return {
      lowEstimate: totalComplexity * 0.8,
      highEstimate: totalComplexity * 1.5,
      unit: "days",
    };
  }
}
