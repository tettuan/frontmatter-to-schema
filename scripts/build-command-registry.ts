#!/usr/bin/env deno run --allow-read --allow-write

import { extract } from "jsr:@std/front-matter/yaml";

interface CommandOption {
  directive: string;
  layer: string;
  input: string | null;
  adaptation: string | null;
  inputTextFile: boolean;
  inputText: boolean;
  destination: boolean;
}

interface CommandDetails {
  frontmatter: Record<string, unknown>;
  variables: string[];
}

interface Command {
  name: string;
  options: CommandOption[];
  details: Map<string, CommandDetails>;
}

async function parsePromptFile(filepath: string): Promise<
  {
    command: string;
    directive: string;
    layer: string;
    input: string | null;
    adaptation: string | null;
    frontmatter: Record<string, unknown>;
    variables: Set<string>;
  } | null
> {
  const content = await Deno.readTextFile(filepath);

  // Parse path to extract command structure
  const pathParts = filepath.split("/");
  const promptsIndex = pathParts.indexOf("prompts");
  const command = pathParts[promptsIndex + 1];
  const directive = pathParts[promptsIndex + 2];
  const layer = pathParts[promptsIndex + 3];
  const filename = pathParts[pathParts.length - 1];

  // Extract input and adaptation from filename
  const fileMatch = filename.match(/f_([^_]+)(?:_(.+))?\.md$/);
  const input = fileMatch?.[1] || null;
  const adaptation = fileMatch?.[2]?.replace(".md", "") || null;

  // Extract frontmatter
  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed = extract(content);
    if (
      typeof parsed.attrs === "object" && parsed.attrs !== null &&
      !Array.isArray(parsed.attrs)
    ) {
      frontmatter = parsed.attrs as Record<string, unknown>;
    }
  } catch {
    // No frontmatter
  }

  // Check for "Notice: この指示書をAgentは選択はしない。"
  if (content.includes("Notice: この指示書をAgentは選択はしない。")) {
    return null;
  }

  // Extract variables from template
  const variablePattern = /\{([^}]+)\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = variablePattern.exec(content)) !== null) {
    variables.add(match[1]);
  }

  return {
    command,
    directive,
    layer,
    input,
    adaptation,
    frontmatter,
    variables,
  };
}

async function buildRegistry() {
  // Get all prompt files
  const promptFiles: string[] = [];
  for await (const entry of Deno.readDir(".agent/climpt/prompts")) {
    if (entry.isDirectory) {
      const commandPath = `.agent/climpt/prompts/${entry.name}`;
      for await (const directive of Deno.readDir(commandPath)) {
        if (directive.isDirectory) {
          const directivePath = `${commandPath}/${directive.name}`;
          for await (const layer of Deno.readDir(directivePath)) {
            if (layer.isDirectory) {
              const layerPath = `${directivePath}/${layer.name}`;
              for await (const file of Deno.readDir(layerPath)) {
                if (
                  file.isFile && file.name.startsWith("f_") &&
                  file.name.endsWith(".md")
                ) {
                  promptFiles.push(`${layerPath}/${file.name}`);
                }
              }
            }
          }
        }
      }
    }
  }

  // Parse all prompt files
  const commands = new Map<string, Command>();

  for (const filepath of promptFiles) {
    const parsed = await parsePromptFile(filepath);
    if (!parsed) continue;

    const commandName = `climpt-${parsed.command}`;

    if (!commands.has(commandName)) {
      commands.set(commandName, {
        name: commandName,
        options: [],
        details: new Map(),
      });
    }

    const command = commands.get(commandName)!;

    // Create option entry
    const option: CommandOption = {
      directive: parsed.directive,
      layer: parsed.layer,
      input: parsed.input === "default" ? "-" : parsed.input,
      adaptation: parsed.adaptation || "default",
      inputTextFile: parsed.variables.has("input_text_file"),
      inputText: parsed.variables.has("input_text"),
      destination: parsed.variables.has("destination_path"),
    };

    command.options.push(option);

    // Store details if frontmatter exists
    if (parsed.frontmatter && Object.keys(parsed.frontmatter).length > 0) {
      const key = `${parsed.directive} ${parsed.layer} ${
        parsed.adaptation || "default"
      }`;
      command.details.set(key, {
        frontmatter: parsed.frontmatter,
        variables: Array.from(parsed.variables),
      });
    }
  }

  return commands;
}

function generateMarkdown(commands: Map<string, Command>) {
  let markdown = "# Climpt Commands Registry\n\n";

  // Sort commands by name
  const sortedCommands = Array.from(commands.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const command of sortedCommands) {
    markdown += `## ${command.name}\n\n`;
    markdown +=
      "|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text (STDIN)|destination(-o)|\n";
    markdown += "|---|---|---|---|---|---|---|\n";

    // Sort options by directive, then layer
    const sortedOptions = command.options.sort((a, b) => {
      const dirCompare = a.directive.localeCompare(b.directive);
      if (dirCompare !== 0) return dirCompare;
      return a.layer.localeCompare(b.layer);
    });

    for (const opt of sortedOptions) {
      markdown += `|${opt.directive}|${opt.layer}|${
        opt.input || "-"
      }|${opt.adaptation}|`;
      markdown += `${opt.inputTextFile ? "✓" : "-"}|${
        opt.inputText ? "✓" : "-"
      }|${opt.destination ? "✓" : "-"}|\n`;
    }

    // Add details
    for (const [key, details] of command.details) {
      markdown += `\n**${command.name} ${key}**:\n`;
      if (details.frontmatter.title) {
        markdown += `${details.frontmatter.title}\n`;
      }
      if (details.frontmatter.description) {
        markdown += `${details.frontmatter.description}\n`;
      }
      if (details.frontmatter.usage) {
        markdown += `Usage: ${details.frontmatter.usage}\n`;
      }

      // Add variable descriptions
      const varDescriptions: { [key: string]: string } = {
        input_text: "今回のスコープを指定する",
        input_text_file: "ざっくり説明された情報を受け取る",
        destination_path: "出力先を複数ファイルで指定",
      };

      for (const variable of details.variables) {
        if (varDescriptions[variable]) {
          markdown += `${variable}: ${varDescriptions[variable]}\n`;
        } else if (variable.startsWith("uv-")) {
          markdown += `${variable}: ${
            variable.replace("uv-", "")
          }のprefixを指定する\n`;
        }
      }
    }

    markdown += "\n";
  }

  return markdown;
}

// Main execution
const commands = await buildRegistry();
const markdown = await generateMarkdown(commands);

// Create directory if it doesn't exist
await Deno.mkdir(".agent/climpt", { recursive: true });

// Write to file
await Deno.writeTextFile(".agent/climpt/registered-commands.md", markdown);

console.log("✅ Command registry built successfully!");
console.log(`📦 Total commands: ${commands.size}`);
let totalOptions = 0;
for (const cmd of commands.values()) {
  totalOptions += cmd.options.length;
}
console.log(`📄 Total options: ${totalOptions}`);
