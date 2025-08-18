#!/usr/bin/env deno run --allow-read --allow-write

/**
 * Example: Build Command Registry
 * 
 * This example demonstrates how to build a command registry
 * from climpt prompt files.
 * 
 * Usage:
 *   deno run --allow-read --allow-write examples/01-build-registry.ts
 *   
 * Or make it executable:
 *   chmod +x examples/01-build-registry.ts
 *   ./examples/01-build-registry.ts
 */

import type { extract } from "https://deno.land/std@0.208.0/front_matter/yaml.ts";

console.log("🚀 Building Climpt Command Registry Example");
console.log("=" .repeat(50));

// Configuration
const PROMPTS_DIR = ".agent/climpt/prompts";
const OUTPUT_FILE = "examples/output/command-registry.md";

interface CommandInfo {
  command: string;
  directive: string;
  layer: string;
  adaptation: string;
  hasInputFile: boolean;
  hasStdin: boolean;
  hasDestination: boolean;
}

async function discoverPrompts(): Promise<CommandInfo[]> {
  const commands: CommandInfo[] = [];
  
  console.log("\n📂 Scanning prompt files...");
  
  for await (const entry of Deno.readDir(PROMPTS_DIR)) {
    if (!entry.isDirectory) continue;
    
    const commandName = entry.name;
    const commandPath = `${PROMPTS_DIR}/${commandName}`;
    
    for await (const directive of Deno.readDir(commandPath)) {
      if (!directive.isDirectory) continue;
      
      const directivePath = `${commandPath}/${directive.name}`;
      
      for await (const layer of Deno.readDir(directivePath)) {
        if (!layer.isDirectory) continue;
        
        const layerPath = `${directivePath}/${layer.name}`;
        
        for await (const file of Deno.readDir(layerPath)) {
          if (!file.name.startsWith("f_") || !file.name.endsWith(".md")) continue;
          
          const filepath = `${layerPath}/${file.name}`;
          const content = await Deno.readTextFile(filepath);
          
          // Extract adaptation from filename
          const match = file.name.match(/f_([^_]+)(?:_(.+))?\.md$/);
          const adaptation = match?.[2]?.replace(".md", "") || match?.[1] || "default";
          
          // Check for variables in content
          const hasInputFile = content.includes("{input_text_file}");
          const hasStdin = content.includes("{input_text}");
          const hasDestination = content.includes("{destination_path}");
          
          commands.push({
            command: commandName,
            directive: directive.name,
            layer: layer.name,
            adaptation,
            hasInputFile,
            hasStdin,
            hasDestination,
          });
          
          console.log(`  ✓ Found: ${commandName}/${directive.name}/${layer.name} (${adaptation})`);
        }
      }
    }
  }
  
  return commands;
}

function generateReport(commands: CommandInfo[]): string {
  let report = "# Climpt Commands Report\n\n";
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Group by command
  const grouped = commands.reduce((acc, cmd) => {
    if (!acc[cmd.command]) acc[cmd.command] = [];
    acc[cmd.command].push(cmd);
    return acc;
  }, {} as Record<string, CommandInfo[]>);
  
  // Statistics
  report += "## Statistics\n\n";
  report += `- Total Commands: ${Object.keys(grouped).length}\n`;
  report += `- Total Variations: ${commands.length}\n\n`;
  
  // Command details
  report += "## Commands\n\n";
  
  for (const [command, variations] of Object.entries(grouped)) {
    report += `### climpt-${command}\n\n`;
    report += "| Directive | Layer | Adaptation | Input File | STDIN | Destination |\n";
    report += "|-----------|-------|------------|------------|-------|-------------|\n";
    
    for (const v of variations) {
      report += `| ${v.directive} | ${v.layer} | ${v.adaptation} | `;
      report += `${v.hasInputFile ? "✓" : "-"} | `;
      report += `${v.hasStdin ? "✓" : "-"} | `;
      report += `${v.hasDestination ? "✓" : "-"} |\n`;
    }
    
    report += "\n";
  }
  
  return report;
}

// Main execution
try {
  const commands = await discoverPrompts();
  
  console.log(`\n📊 Found ${commands.length} command variations`);
  
  // Generate report
  const report = generateReport(commands);
  
  // Ensure output directory exists
  await Deno.mkdir("examples/output", { recursive: true });
  
  // Write report
  await Deno.writeTextFile(OUTPUT_FILE, report);
  
  console.log(`\n✅ Report generated: ${OUTPUT_FILE}`);
  console.log("\n📄 Preview:");
  console.log("-".repeat(50));
  console.log(report.substring(0, 500) + "...");
  
} catch (error) {
  console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}