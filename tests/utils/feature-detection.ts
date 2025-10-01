/**
 * Feature Detection Utilities for Robust Testing
 *
 * Provides capability detection to enable conditional test execution
 * based on actual implementation status.
 */

import { ensureDir } from "@std/fs";
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

    // Create directory structure using ensureDir
    await ensureDir(testDir);

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
      capabilities.templateProcessing = await this.testTemplateProcessing(
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
      capabilities.directiveHandling = await this.testDirectiveHandling(
        orchestrator,
      );
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

    // Create minimal test files with Result error checking
    const mdResult = await fileSystem.writeTextFile(
      `${testDir}/test.md`,
      `---
title: "Test"
---
Content`,
    );
    if (mdResult.isError()) {
      console.log(
        `⚠️  Failed to create test.md: ${
          JSON.stringify(mdResult.unwrapError())
        }`,
      );
      return false;
    }

    const schemaResult = await fileSystem.writeTextFile(
      `${testDir}/schema.json`,
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "title": { "type": "string" },
        },
      }),
    );
    if (schemaResult.isError()) {
      console.log(
        `⚠️  Failed to create schema.json: ${
          JSON.stringify(schemaResult.unwrapError())
        }`,
      );
      return false;
    }

    const templateResult = await fileSystem.writeTextFile(
      `${testDir}/template.json`,
      JSON.stringify({
        "title": "{title}",
      }),
    );
    if (templateResult.isError()) {
      console.log(
        `⚠️  Failed to create template.json: ${
          JSON.stringify(templateResult.unwrapError())
        }`,
      );
      return false;
    }

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

    // Test with missing schema file - should return an error
    const result = await orchestrator.execute({
      schemaPath: `${testDir}/nonexistent.json`,
      templatePath: `${testDir}/template.json`,
      inputPath: `${testDir}/test.md`,
      outputPath: `${testDir}/output.json`,
      outputFormat: "json",
    });

    // Error handling is working if we get an error result (not a crash)
    return result.isError();
  }

  private static async testTemplateProcessing(
    orchestrator: PipelineOrchestrator,
  ): Promise<boolean> {
    const { fileSystem, testDir } = await this.createTestEnvironment(
      "template",
    );

    // Create test files with template variable substitution
    const mdResult = await fileSystem.writeTextFile(
      `${testDir}/test.md`,
      `---
title: "Template Test"
value: "Substituted"
---
Content`,
    );
    if (mdResult.isError()) return false;

    const schemaResult = await fileSystem.writeTextFile(
      `${testDir}/schema.json`,
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "value": { "type": "string" },
        },
      }),
    );
    if (schemaResult.isError()) return false;

    const templateResult = await fileSystem.writeTextFile(
      `${testDir}/template.json`,
      JSON.stringify({
        "output": "{value}",
      }),
    );
    if (templateResult.isError()) return false;

    const result = await orchestrator.execute({
      schemaPath: `${testDir}/schema.json`,
      templatePath: `${testDir}/template.json`,
      inputPath: `${testDir}/test.md`,
      outputPath: `${testDir}/output.json`,
      outputFormat: "json",
    });

    if (result.isError()) return false;

    // Check if template variable was substituted by reading output
    const outputResult = await fileSystem.readTextFile(
      `${testDir}/output.json`,
    );
    if (outputResult.isError()) return false;

    const output = outputResult.unwrap();
    // Template processing works if the variable {value} was replaced
    return output.includes('"Substituted"');
  }

  private static async testDirectiveHandling(
    orchestrator: PipelineOrchestrator,
  ): Promise<boolean> {
    const { fileSystem, testDir } = await this.createTestEnvironment(
      "directive",
    );

    // Test x-template directive in schema
    const mdResult = await fileSystem.writeTextFile(
      `${testDir}/test.md`,
      `---
name: "Directive Test"
---
Content`,
    );
    if (mdResult.isError()) return false;

    const templateResult = await fileSystem.writeTextFile(
      `${testDir}/template.json`,
      JSON.stringify({
        "item": "{name}",
      }),
    );
    if (templateResult.isError()) return false;

    // Schema with x-template directive
    const schemaResult = await fileSystem.writeTextFile(
      `${testDir}/schema.json`,
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": "./template.json",
        "properties": {
          "name": { "type": "string" },
        },
      }),
    );
    if (schemaResult.isError()) return false;

    const result = await orchestrator.execute({
      schemaPath: `${testDir}/schema.json`,
      templatePath: `${testDir}/template.json`,
      inputPath: `${testDir}/test.md`,
      outputPath: `${testDir}/output.json`,
      outputFormat: "json",
    });

    // Directive handling works if processing succeeds with x-template directive
    return result.isOk();
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
