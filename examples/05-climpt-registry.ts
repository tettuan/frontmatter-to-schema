#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * Example: Climpt Registry Generation
 * 
 * This example demonstrates the generic frontmatter analysis system
 * by processing Climpt prompt files to generate a command registry.
 */

import { extract } from "https://deno.land/std@0.208.0/front_matter/yaml.ts";

// Schema definition for Climpt registry
const registrySchema = {
  version: "string",
  description: "string",
  tools: {
    availableConfigs: ["string"],
    commands: [{
      c1: "string",
      c2: "string", 
      c3: "string",
      description: "string",
      usage: "string",
      options: {
        input: ["string"],
        adaptation: ["string"],
        input_file: ["boolean"],
        stdin: ["boolean"],
        destination: ["boolean"]
      }
    }]
  }
};

// Template for the registry output
const registryTemplate = {
  version: "1.0.0",
  description: "Climpt comprehensive configuration for MCP server and command registry",
  tools: {
    availableConfigs: [] as string[],
    commands: [] as any[]
  }
};

/**
 * Simple frontmatter extractor using Deno's standard library
 */
class DenoFrontMatterExtractor {
  async extract(content: string) {
    try {
      const parsed = extract(content);
      return parsed.attrs;
    } catch {
      return null;
    }
  }
}

/**
 * Mock Claude API client for demonstration
 */
class MockClaudeClient {
  async analyze(prompt: string): Promise<any> {
    // In real implementation, this would call Claude API
    // For demo, we'll parse based on the prompt content
    
    if (prompt.includes("extract structured information")) {
      // Mock extraction response
      return {
        c1: "git",
        c2: "create",
        c3: "refinement-issue",
        description: "Create a refinement issue from requirements",
        usage: "climpt-git create refinement-issue -f requirements.md"
      };
    }
    
    if (prompt.includes("Map the provided extracted data")) {
      // Mock mapping response
      return {
        commands: [{
          c1: "git",
          c2: "create",
          c3: "refinement-issue",
          description: "Create a refinement issue from requirements",
          usage: "climpt-git create refinement-issue -f requirements.md",
          options: {
            input: ["MD"],
            adaptation: ["default"],
            input_file: [true],
            stdin: [false],
            destination: [true]
          }
        }]
      };
    }
    
    return {};
  }
}

/**
 * File discovery implementation
 */
class FileSystemDiscovery {
  async discover(patterns: string[]): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of patterns) {
      // Simple implementation - in production use glob
      for await (const entry of Deno.readDir(pattern)) {
        if (entry.isFile && entry.name.endsWith('.md')) {
          files.push(`${pattern}/${entry.name}`);
        }
      }
    }
    
    return files;
  }
}

/**
 * Analysis pipeline for Climpt registry
 */
class ClimptAnalysisPipeline {
  private extractor = new DenoFrontMatterExtractor();
  private claude = new MockClaudeClient();
  private discovery = new FileSystemDiscovery();
  private results: any[] = [];
  
  async process(inputPath: string): Promise<any> {
    console.log("🔍 Discovering prompt files...");
    
    // Check if the directory exists
    try {
      await Deno.stat(inputPath);
    } catch {
      console.log("ℹ️ Directory not found, using mock data for demonstration");
      return this.generateMockRegistry();
    }
    
    const files = await this.discovery.discover([inputPath]);
    console.log(`📁 Found ${files.length} files`);
    
    for (const file of files) {
      await this.processFile(file);
    }
    
    return this.buildRegistry();
  }
  
  private async processFile(filePath: string) {
    console.log(`📄 Processing: ${filePath}`);
    
    const content = await Deno.readTextFile(filePath);
    const frontMatter = await this.extractor.extract(content);
    
    if (!frontMatter) {
      console.log(`  ⚠️ No frontmatter found`);
      return;
    }
    
    // Extract information using Claude (mock)
    const extractPrompt = this.buildExtractionPrompt(frontMatter);
    const extracted = await this.claude.analyze(extractPrompt);
    
    // Map to template using Claude (mock)
    const mappingPrompt = this.buildMappingPrompt(extracted);
    const mapped = await this.claude.analyze(mappingPrompt);
    
    if (mapped.commands) {
      this.results.push(...mapped.commands);
    }
  }
  
  private buildExtractionPrompt(frontMatter: any): string {
    return `Extract structured information from frontmatter:
    ${JSON.stringify(frontMatter)}
    Schema: ${JSON.stringify(registrySchema)}`;
  }
  
  private buildMappingPrompt(extracted: any): string {
    return `Map the provided extracted data to template:
    Data: ${JSON.stringify(extracted)}
    Template: ${JSON.stringify(registryTemplate)}`;
  }
  
  private buildRegistry(): any {
    const registry = { ...registryTemplate };
    
    // Extract unique configs
    const configs = new Set<string>();
    this.results.forEach(cmd => configs.add(cmd.c1));
    registry.tools.availableConfigs = Array.from(configs).sort();
    
    // Add all commands
    registry.tools.commands = this.results;
    
    return registry;
  }
  
  private generateMockRegistry(): any {
    // Generate mock data for demonstration
    return {
      version: "1.0.0",
      description: "Climpt comprehensive configuration for MCP server and command registry",
      tools: {
        availableConfigs: ["git", "spec", "test", "code", "docs", "meta"],
        commands: [
          {
            c1: "git",
            c2: "create",
            c3: "refinement-issue",
            description: "Create a refinement issue from requirements documentation",
            usage: "climpt-git create refinement-issue -f requirements.md",
            options: {
              input: ["MD"],
              adaptation: ["default", "detailed"],
              input_file: [true],
              stdin: [false],
              destination: [true]
            }
          },
          {
            c1: "git",
            c2: "analyze",
            c3: "commit-history",
            description: "Analyze commit history and generate insights",
            usage: "echo 'main..feature' | climpt-git analyze commit-history",
            options: {
              input: ["text"],
              adaptation: ["default"],
              input_file: [false],
              stdin: [true],
              destination: [false]
            }
          },
          {
            c1: "spec",
            c2: "analyze",
            c3: "quality-metrics",
            description: "Analyze specification quality and completeness",
            usage: "climpt-spec analyze quality-metrics -f spec.md -o report.json",
            options: {
              input: ["MD"],
              adaptation: ["default"],
              input_file: [true],
              stdin: [false],
              destination: [true]
            }
          },
          {
            c1: "code",
            c2: "create",
            c3: "implementation",
            description: "Create implementation from design documents",
            usage: "climpt-code create implementation -f design.md -a detailed -o src/",
            options: {
              input: ["MD"],
              adaptation: ["default", "detailed"],
              input_file: [true],
              stdin: [false],
              destination: [true]
            }
          },
          {
            c1: "meta",
            c2: "list",
            c3: "available-commands",
            description: "List all available Climpt commands",
            usage: "climpt-meta list available-commands",
            options: {
              input: ["none"],
              adaptation: ["default"],
              input_file: [false],
              stdin: [false],
              destination: [false]
            }
          }
        ]
      }
    };
  }
}

// Main execution
async function main() {
  console.log("=== Climpt Registry Generation Example ===\n");
  
  const pipeline = new ClimptAnalysisPipeline();
  
  // Process the Climpt prompts directory
  const inputPath = ".agent/climpt/prompts";
  const registry = await pipeline.process(inputPath);
  
  // Output the registry
  const outputPath = "examples/output/climpt-registry.json";
  await Deno.mkdir("examples/output", { recursive: true });
  await Deno.writeTextFile(
    outputPath,
    JSON.stringify(registry, null, 2)
  );
  
  console.log("\n✅ Registry generated successfully!");
  console.log(`📦 Output saved to: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`  - Configurations: ${registry.tools.availableConfigs.length}`);
  console.log(`  - Commands: ${registry.tools.commands.length}`);
  
  // Display sample command
  if (registry.tools.commands.length > 0) {
    const sample = registry.tools.commands[0];
    console.log(`\n📌 Sample command:`);
    console.log(`  ${sample.c1}-${sample.c2}-${sample.c3}: ${sample.description}`);
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}