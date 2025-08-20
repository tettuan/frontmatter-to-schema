#!/usr/bin/env deno run --allow-read --allow-write --allow-run --allow-env

/**
 * Example demonstrating the redesigned high-abstraction frontmatter analysis system
 *
 * This example showcases the new architecture's flexibility and extensibility,
 * comparing it with the original implementation.
 */

import { ClimptPipelineFactory } from "../src/application/climpt/climpt-adapter.ts";

console.log("🏗️  Redesigned Architecture Example");
console.log("=====================================\n");

/**
 * Example 1: Basic usage with default configuration
 */
async function basicUsageExample() {
  console.log("📝 Example 1: Basic usage with default configuration");
  console.log("-".repeat(50));

  try {
    // Create pipeline with default Climpt configuration
    const pipeline = await ClimptPipelineFactory.createDefault();

    // Process a sample directory (create sample data if needed)
    const sampleDir = "examples/sample-prompts";
    await ensureSamplePrompts(sampleDir);

    // Process and generate registry
    const registry = await pipeline.processAndSave(
      sampleDir,
      "examples/output/redesigned-registry.json",
    );

    console.log("✅ Basic example completed successfully!");
    console.log(`   Generated ${registry.tools.commands.length} commands`);
    console.log(
      `   Available configs: ${registry.tools.availableConfigs.join(", ")}`,
    );
  } catch (error) {
    console.error("❌ Basic example failed:", error);
  }

  console.log("");
}

/**
 * Example 2: Advanced usage with custom schema and hooks
 */
async function advancedUsageExample() {
  console.log("🔧 Example 2: Advanced usage with hooks and custom processing");
  console.log("-".repeat(60));

  try {
    // Create pipeline with default configuration
    const pipeline = await ClimptPipelineFactory.createDefault();

    // Add custom hooks for extended functionality
    pipeline.setHooks({
      beforeProcess: async (input) => {
        console.log(`🔄 Pre-processing: ${input.sourceDirectory}`);
        // Add custom pre-processing logic here
        return await Promise.resolve(input);
      },

      afterProcess: async (output) => {
        console.log(`📊 Post-processing: ${output.results.length} results`);

        // Example: Add custom metadata analysis
        const successRate =
          (output.summary.successfulFiles / output.summary.totalFiles) * 100;
        console.log(`   Success rate: ${successRate.toFixed(1)}%`);

        return await Promise.resolve(output);
      },

      onError: async (error, input) => {
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);
        console.error(
          `⚠️  Pipeline error for ${input.sourceDirectory}: ${errorMessage}`,
        );
        // Add custom error handling/reporting here
        return await Promise.resolve();
      },
    });

    // Process with advanced options
    const registry = await pipeline.processAndSave(
      "examples/sample-prompts",
      "examples/output/advanced-registry.json",
      {
        includeMetadata: true,
        validateResults: true,
        customAnalysis: true,
      },
    );

    console.log("✅ Advanced example completed!");
    console.log(
      `   Generated registry with ${registry.tools.commands.length} commands`,
    );
  } catch (error) {
    console.error("❌ Advanced example failed:", error);
  }

  console.log("");
}

/**
 * Example 3: Comparing architectures - extensibility demonstration
 */
async function extensibilityExample() {
  console.log("🔄 Example 3: Architecture comparison - Extensibility");
  console.log("-".repeat(55));

  console.log("📋 Original Architecture Limitations:");
  console.log("   - Fixed to Climpt-specific logic");
  console.log("   - Hard-coded file processing");
  console.log("   - Limited error handling");
  console.log("   - No plugin system");
  console.log("");

  console.log("🚀 Redesigned Architecture Benefits:");
  console.log("   ✓ Schema-driven configuration");
  console.log("   ✓ Pluggable analysis services");
  console.log("   ✓ Template-based output generation");
  console.log("   ✓ Extensible pipeline with hooks");
  console.log("   ✓ Configurable at multiple levels");
  console.log("");

  // Demonstrate multiple use cases with the same core engine
  console.log("🎯 Multiple Use Cases Demo:");

  try {
    // Use case 1: Standard Climpt registry
    const climptPipeline = await ClimptPipelineFactory.createDefault();
    const climptResult = await climptPipeline.processAndSave(
      "examples/sample-prompts",
      "examples/output/climpt-use-case.json",
    );

    console.log(
      `   📦 Climpt registry: ${climptResult.tools.commands.length} commands`,
    );

    // Future use cases could easily be added:
    // - Documentation generator
    // - API specification builder
    // - Test case generator
    // - Configuration validator

    console.log(
      "   🔮 Future use cases: Docs, API specs, Tests, Config validation",
    );
  } catch (error) {
    console.error("❌ Extensibility demo failed:", error);
  }

  console.log("");
}

/**
 * Example 4: Performance and error handling demonstration
 */
async function performanceExample() {
  console.log("⚡ Example 4: Performance and error handling");
  console.log("-".repeat(45));

  try {
    const startTime = Date.now();

    const pipeline = await ClimptPipelineFactory.createDefault();

    // Process multiple directories in parallel (if they existed)
    const results = await Promise.allSettled([
      pipeline.processAndSave(
        "examples/sample-prompts",
        "examples/output/performance-test-1.json",
      ),
    ]);

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log(`⏱️  Processing completed in ${processingTime}ms`);

    // Analyze results
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(
          `   ✅ Task ${
            index + 1
          }: Success - ${result.value.tools.commands.length} commands`,
        );
      } else {
        console.log(`   ❌ Task ${index + 1}: Failed - ${result.reason}`);
      }
    });
  } catch (error) {
    console.error("❌ Performance example failed:", error);
  }

  console.log("");
}

/**
 * Create sample prompt files for testing
 */
async function ensureSamplePrompts(dir: string) {
  try {
    await Deno.mkdir(dir, { recursive: true });

    // Sample prompt 1: Git command
    const gitPrompt = `---
c1: git
c2: create
c3: refinement-issue
description: Create a refinement issue from requirements documentation
usage: Create refinement issues from requirement documents
input: [MD]
adaptation: [default, detailed]
input_file: [true]
stdin: [false]
destination: [true]
---

# Git Refinement Issue Creator

This prompt creates refinement issues from requirements documentation.

## Usage

\`\`\`bash
climpt-git create refinement-issue -f requirements.md
\`\`\`
`;

    // Sample prompt 2: Test command
    const testPrompt = `---
c1: test
c2: execute
c3: integration-suite  
description: Execute integration test suite
usage: Run comprehensive integration tests
input: [CODE, CONFIG]
adaptation: [fast, thorough]
input_file: [false]
stdin: [true]
destination: [true]
---

# Integration Test Executor

This prompt executes integration test suites with comprehensive coverage.
`;

    await Promise.all([
      Deno.writeTextFile(`${dir}/git-create-refinement.md`, gitPrompt),
      Deno.writeTextFile(`${dir}/test-execute-integration.md`, testPrompt),
    ]);
  } catch (error) {
    console.warn("Warning: Could not create sample prompts:", error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("Starting redesigned architecture examples...\n");

  await basicUsageExample();
  await advancedUsageExample();
  await extensibilityExample();
  await performanceExample();

  console.log("🎉 All examples completed!");
  console.log("\n📁 Generated files:");
  console.log("   - examples/output/redesigned-registry.json");
  console.log("   - examples/output/advanced-registry.json");
  console.log("   - examples/output/climpt-use-case.json");
  console.log("   - examples/output/performance-test-1.json");

  console.log("\n💡 Key improvements demonstrated:");
  console.log("   ✅ Higher abstraction level");
  console.log("   ✅ Schema-driven configuration");
  console.log("   ✅ Extensible pipeline architecture");
  console.log("   ✅ Better separation of concerns");
  console.log("   ✅ Improved error handling");
  console.log("   ✅ Plugin-ready design");
}

if (import.meta.main) {
  await main();
}
