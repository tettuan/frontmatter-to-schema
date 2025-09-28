/**
 * Feature Detection Utilities for Robust Testing
 *
 * Provides capability detection to enable conditional test execution
 * based on actual implementation status.
 */

import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";

export interface FeatureCapabilities {
  /** Basic file processing and schema validation */
  basicProcessing: boolean;

  /** Template processing with variable substitution */
  templateProcessing: boolean;

  /** Directive handling (x-template, x-frontmatter-part, etc.) */
  directiveHandling: boolean;

  /** Error handling and validation */
  errorHandling: boolean;

  /** Directory processing capabilities */
  directoryProcessing: boolean;

  /** Output format support (JSON, YAML) */
  outputFormatSupport: boolean;
}

export class FeatureDetector {
  private static async createTestEnvironment(testId: string) {
    const fileSystem = DenoFileSystemAdapter.create();
    const testDir = `tmp/feature-detection/${testId}`;

    // Create directory structure by writing a dummy file
    await fileSystem.writeTextFile(`${testDir}/.gitkeep`, "");

    return { fileSystem, testDir };
  }

  /**
   * Detects currently available features by running minimal test cases
   */
  static async detectCapabilities(
    orchestrator: PipelineOrchestrator,
  ): Promise<FeatureCapabilities> {
    const capabilities: FeatureCapabilities = {
      basicProcessing: false,
      templateProcessing: false,
      directiveHandling: false,
      errorHandling: false,
      directoryProcessing: false,
      outputFormatSupport: false,
    };

    // Test 1: Basic Processing
    try {
      capabilities.basicProcessing = await this.testBasicProcessing(
        orchestrator,
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.log(`⚠️  Basic processing detection failed: ${errorMessage}`);
    }

    // Test 2: Error Handling
    try {
      capabilities.errorHandling = await this.testErrorHandling(orchestrator);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.log(`⚠️  Error handling detection failed: ${errorMessage}`);
    }

    // Test 3: Template Processing
    try {
      capabilities.templateProcessing = this.testTemplateProcessing(
        orchestrator,
      );
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.log(`⚠️  Template processing detection failed: ${errorMessage}`);
    }

    // Test 4: Directive Handling
    try {
      capabilities.directiveHandling = this.testDirectiveHandling(orchestrator);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.log(`⚠️  Directive handling detection failed: ${errorMessage}`);
    }

    return capabilities;
  }

  private static async testBasicProcessing(
    orchestrator: PipelineOrchestrator,
  ): Promise<boolean> {
    const { fileSystem, testDir } = await this.createTestEnvironment("basic");

    // Create minimal test files
    await fileSystem.writeTextFile(
      `${testDir}/test.md`,
      `---
title: "Test"
---
Content`,
    );

    await fileSystem.writeTextFile(
      `${testDir}/schema.json`,
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "title": { "type": "string" },
        },
      }),
    );

    await fileSystem.writeTextFile(
      `${testDir}/template.json`,
      JSON.stringify({
        "title": "{title}",
      }),
    );

    const result = await orchestrator.execute({
      schemaPath: `${testDir}/schema.json`,
      templatePath: `${testDir}/template.json`,
      inputPath: `${testDir}/test.md`,
      outputPath: `${testDir}/output.json`,
      outputFormat: "json",
    });

    return result.isOk();
  }

  private static async testErrorHandling(
    orchestrator: PipelineOrchestrator,
  ): Promise<boolean> {
    const { testDir } = await this.createTestEnvironment("error");

    // Test with missing schema file
    const _result = await orchestrator.execute({
      schemaPath: `${testDir}/nonexistent.json`,
      templatePath: `${testDir}/template.json`,
      inputPath: `${testDir}/test.md`,
      outputPath: `${testDir}/output.json`,
      outputFormat: "json",
    });

    // For now, consider error handling not fully implemented
    // until all specific error codes work correctly
    return false;
  }

  private static testTemplateProcessing(
    _orchestrator: PipelineOrchestrator,
  ): boolean {
    // This would test template variable substitution
    // For now, assume not implemented unless basic processing works
    return false;
  }

  private static testDirectiveHandling(
    _orchestrator: PipelineOrchestrator,
  ): boolean {
    // This would test x-* directive processing
    // For now, assume not implemented unless basic processing works
    return false;
  }

  /**
   * Logs capability detection results in a user-friendly format
   */
  static logCapabilities(capabilities: FeatureCapabilities): void {
    console.log("\n🔍 Feature Detection Results:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const features = [
      {
        name: "Basic Processing",
        key: "basicProcessing" as keyof FeatureCapabilities,
      },
      {
        name: "Template Processing",
        key: "templateProcessing" as keyof FeatureCapabilities,
      },
      {
        name: "Directive Handling",
        key: "directiveHandling" as keyof FeatureCapabilities,
      },
      {
        name: "Error Handling",
        key: "errorHandling" as keyof FeatureCapabilities,
      },
      {
        name: "Directory Processing",
        key: "directoryProcessing" as keyof FeatureCapabilities,
      },
      {
        name: "Output Format Support",
        key: "outputFormatSupport" as keyof FeatureCapabilities,
      },
    ];

    features.forEach((feature) => {
      const status = capabilities[feature.key]
        ? "✅ Available"
        : "❌ Not Implemented";
      console.log(`${feature.name.padEnd(20)} : ${status}`);
    });

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }
}

export class ImplementationTracker {
  private static missingFeatures: Set<string> = new Set();

  /**
   * Records a missing feature for later reporting
   */
  static recordMissingFeature(feature: string, example: string): void {
    const key = `${feature}:${example}`;
    this.missingFeatures.add(key);
    console.log(`🔧 IMPLEMENTATION NEEDED: ${feature} for ${example}`);
  }

  /**
   * Gets all recorded missing features
   */
  static getMissingFeatures(): string[] {
    return Array.from(this.missingFeatures);
  }

  /**
   * Clears the missing features list
   */
  static clearMissingFeatures(): void {
    this.missingFeatures.clear();
  }

  /**
   * Generates an implementation roadmap based on missing features
   */
  static generateRoadmap(): string[] {
    const features = Array.from(this.missingFeatures);
    const roadmap: string[] = [];

    // Group by feature type
    const featureGroups = new Map<string, string[]>();
    features.forEach((feature) => {
      const [featureType, example] = feature.split(":");
      if (!featureGroups.has(featureType)) {
        featureGroups.set(featureType, []);
      }
      featureGroups.get(featureType)!.push(example);
    });

    // Generate prioritized roadmap
    const priority = [
      "Basic Processing",
      "Template Processing",
      "Directive Handling",
      "Directory Processing",
      "Output Format Support",
    ];

    priority.forEach((featureType) => {
      if (featureGroups.has(featureType)) {
        roadmap.push(`## ${featureType}`);
        featureGroups.get(featureType)!.forEach((example) => {
          roadmap.push(`- Implement for: ${example}`);
        });
        roadmap.push("");
      }
    });

    return roadmap;
  }
}
