/**
 * Robust Test Runner Utility
 *
 * Provides conditional test execution based on feature capabilities
 * without requiring manual modification of every test case.
 */

import { ImplementationTracker, type FeatureCapabilities } from "./feature-detection.ts";

export interface TestRequirements {
  basicProcessing?: boolean;
  templateProcessing?: boolean;
  directiveHandling?: boolean;
  errorHandling?: boolean;
  directoryProcessing?: boolean;
  outputFormatSupport?: boolean;
}

export class RobustTestRunner {
  constructor(private capabilities: FeatureCapabilities) {}

  /**
   * Executes a test step conditionally based on feature requirements
   */
  async executeConditional(
    testName: string,
    requirements: TestRequirements,
    testFunction: () => Promise<void>
  ): Promise<void> {
    // Check if all required capabilities are available
    const missingCapabilities = this.checkMissingCapabilities(requirements);

    if (missingCapabilities.length > 0) {
      // Skip test and record missing features
      const featureType = this.getFeatureType(requirements);
      ImplementationTracker.recordMissingFeature(featureType, testName);
      console.log(`⚠️  SKIP: ${testName} - Missing: ${missingCapabilities.join(', ')}`);
      return;
    }

    // All requirements met, run the test
    await testFunction();
  }

  private checkMissingCapabilities(requirements: TestRequirements): string[] {
    const missing: string[] = [];

    if (requirements.basicProcessing && !this.capabilities.basicProcessing) {
      missing.push("Basic Processing");
    }
    if (requirements.templateProcessing && !this.capabilities.templateProcessing) {
      missing.push("Template Processing");
    }
    if (requirements.directiveHandling && !this.capabilities.directiveHandling) {
      missing.push("Directive Handling");
    }
    if (requirements.errorHandling && !this.capabilities.errorHandling) {
      missing.push("Error Handling");
    }
    if (requirements.directoryProcessing && !this.capabilities.directoryProcessing) {
      missing.push("Directory Processing");
    }
    if (requirements.outputFormatSupport && !this.capabilities.outputFormatSupport) {
      missing.push("Output Format Support");
    }

    return missing;
  }

  private getFeatureType(requirements: TestRequirements): string {
    // Return the primary feature type for this test
    if (requirements.directoryProcessing) return "Directory Processing";
    if (requirements.templateProcessing) return "Template Processing";
    if (requirements.directiveHandling) return "Directive Handling";
    if (requirements.outputFormatSupport) return "Output Format Support";
    if (requirements.errorHandling) return "Error Handling";
    if (requirements.basicProcessing) return "Basic Processing";
    return "Unknown Feature";
  }

  /**
   * Creates test requirements for common patterns
   */
  static requirements = {
    basicProcessing: { basicProcessing: true } as TestRequirements,
    directoryProcessing: { basicProcessing: true, directoryProcessing: true } as TestRequirements,
    templateProcessing: { basicProcessing: true, templateProcessing: true } as TestRequirements,
    directiveHandling: { basicProcessing: true, directiveHandling: true } as TestRequirements,
    errorHandling: { errorHandling: true } as TestRequirements,
    yamlOutput: { basicProcessing: true, outputFormatSupport: true } as TestRequirements,
    complexProcessing: {
      basicProcessing: true,
      templateProcessing: true,
      directiveHandling: true
    } as TestRequirements,
  };
}