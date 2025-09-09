import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  CLIArgumentParser,
  InputPattern,
  OutputPath,
  SchemaPath,
} from "../../src/presentation/cli-arguments.ts";

Deno.test("SchemaPath.create should accept valid JSON schema path", () => {
  const result = SchemaPath.create("schema.json");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "schema.json");
    assertEquals(result.data.getFileName(), "schema.json");
    assertEquals(result.data.getDirectory(), ".");
  }
});

Deno.test("SchemaPath.create should normalize path separators", () => {
  const result = SchemaPath.create("path\\to\\schema.json");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "path/to/schema.json");
  }
});

Deno.test("SchemaPath.create should collapse multiple slashes", () => {
  const result = SchemaPath.create("path//to///schema.json");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "path/to/schema.json");
  }
});

Deno.test("SchemaPath.create should reject empty path", () => {
  const result = SchemaPath.create("");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyPath");
    assertEquals(result.error.message, "Schema path cannot be empty");
  }
});

Deno.test("SchemaPath.create should reject whitespace-only path", () => {
  const result = SchemaPath.create("   ");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyPath");
  }
});

Deno.test("SchemaPath.create should reject non-JSON files", () => {
  const result = SchemaPath.create("schema.yaml");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidExtension");
    assertEquals(
      result.error.message,
      "Schema file must be .json, got: schema.yaml",
    );
  }
});

Deno.test("SchemaPath getDirectory should return directory path", () => {
  const result = SchemaPath.create("path/to/schema.json");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getDirectory(), "path/to");
  }
});

Deno.test("SchemaPath getFileName should return file name", () => {
  const result = SchemaPath.create("path/to/schema.json");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getFileName(), "schema.json");
  }
});

Deno.test("OutputPath.create should accept JSON output", () => {
  const result = OutputPath.create("output.json");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "output.json");
    assertEquals(result.data.getFormat(), "json");
  }
});

Deno.test("OutputPath.create should accept YAML output", () => {
  const result = OutputPath.create("output.yaml");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "output.yaml");
    assertEquals(result.data.getFormat(), "yaml");
  }
});

Deno.test("OutputPath.create should treat yml as yaml", () => {
  const result = OutputPath.create("output.yml");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "output.yml");
    assertEquals(result.data.getFormat(), "yaml");
  }
});

Deno.test("OutputPath.create should accept TOML output", () => {
  const result = OutputPath.create("output.toml");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "output.toml");
    assertEquals(result.data.getFormat(), "toml");
  }
});

Deno.test("OutputPath.create should reject empty path", () => {
  const result = OutputPath.create("");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyPath");
    assertEquals(result.error.message, "Output path cannot be empty");
  }
});

Deno.test("OutputPath.create should reject whitespace-only path", () => {
  const result = OutputPath.create("   ");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyPath");
  }
});

Deno.test("OutputPath.create should reject unsupported formats", () => {
  const result = OutputPath.create("output.txt");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "UnsupportedFormat");
    assertEquals(
      result.error.message,
      "Output format must be one of: json, yml, yaml, toml",
    );
  }
});

Deno.test("OutputPath.create should reject files without extension", () => {
  const result = OutputPath.create("output");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "UnsupportedFormat");
  }
});

Deno.test("InputPattern.create should accept valid pattern", () => {
  const result = InputPattern.create("**/*.md");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "**/*.md");
    assertEquals(result.data.toGlob(), "**/*.md");
  }
});

Deno.test("InputPattern.create should trim whitespace", () => {
  const result = InputPattern.create("  **/*.md  ");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toString(), "**/*.md");
  }
});

Deno.test("InputPattern.create should reject empty pattern", () => {
  const result = InputPattern.create("");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyPattern");
    assertEquals(result.error.message, "Input pattern cannot be empty");
  }
});

Deno.test("InputPattern.create should reject whitespace-only pattern", () => {
  const result = InputPattern.create("   ");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyPattern");
  }
});

Deno.test("InputPattern toGlob should add **/*.md to directory paths", () => {
  const result = InputPattern.create("docs");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toGlob(), "docs/**/*.md");
  }
});

Deno.test("InputPattern toGlob should handle trailing slash", () => {
  const result = InputPattern.create("docs/");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toGlob(), "docs/**/*.md");
  }
});

Deno.test("InputPattern toGlob should preserve existing glob patterns", () => {
  const result = InputPattern.create("docs/*.md");
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.toGlob(), "docs/*.md");
  }
});

Deno.test("CLIArgumentParser.parse should parse valid arguments", () => {
  const args = ["schema.json", "output.json", "**/*.md"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.schemaPath.toString(), "schema.json");
    assertEquals(result.data.outputPath.toString(), "output.json");
    assertEquals(result.data.inputPattern.toString(), "**/*.md");
    assertEquals(result.data.options.help, false);
    assertEquals(result.data.options.version, false);
    assertEquals(result.data.options.verbose, false);
    assertEquals(result.data.options.quiet, false);
    assertEquals(result.data.options.dryRun, false);
    assertEquals(result.data.options.parallel, false);
  }
});

Deno.test("CLIArgumentParser.parse should handle help flag", () => {
  const args = ["-h"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.help, true);
  }
});

Deno.test("CLIArgumentParser.parse should handle long help flag", () => {
  const args = ["--help"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.help, true);
  }
});

Deno.test("CLIArgumentParser.parse should handle version flag", () => {
  const args = ["--version"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.version, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse verbose flag", () => {
  const args = ["schema.json", "output.json", "**/*.md", "-v"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.verbose, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse long verbose flag", () => {
  const args = ["schema.json", "output.json", "**/*.md", "--verbose"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.verbose, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse quiet flag", () => {
  const args = ["schema.json", "output.json", "**/*.md", "-q"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.quiet, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse long quiet flag", () => {
  const args = ["schema.json", "output.json", "**/*.md", "--quiet"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.quiet, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse dry-run flag", () => {
  const args = ["schema.json", "output.json", "**/*.md", "--dry-run"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.dryRun, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse parallel flag", () => {
  const args = ["schema.json", "output.json", "**/*.md", "-p"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.parallel, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse long parallel flag", () => {
  const args = ["schema.json", "output.json", "**/*.md", "--parallel"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.parallel, true);
  }
});

Deno.test("CLIArgumentParser.parse should parse max-workers option", () => {
  const args = ["schema.json", "output.json", "**/*.md", "--max-workers", "4"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.maxWorkers, 4);
  }
});

Deno.test("CLIArgumentParser.parse should ignore invalid max-workers value", () => {
  const args = [
    "schema.json",
    "output.json",
    "**/*.md",
    "--max-workers",
    "invalid",
  ];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.maxWorkers, undefined);
  }
});

Deno.test("CLIArgumentParser.parse should ignore negative max-workers value", () => {
  const args = ["schema.json", "output.json", "**/*.md", "--max-workers", "-1"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.maxWorkers, undefined);
  }
});

Deno.test("CLIArgumentParser.parse should handle max-workers without value", () => {
  const args = ["schema.json", "output.json", "**/*.md", "--max-workers"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.maxWorkers, undefined);
  }
});

Deno.test("CLIArgumentParser.parse should parse multiple flags", () => {
  const args = [
    "schema.json",
    "output.json",
    "**/*.md",
    "-v",
    "-p",
    "--dry-run",
  ];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.options.verbose, true);
    assertEquals(result.data.options.parallel, true);
    assertEquals(result.data.options.dryRun, true);
  }
});

Deno.test("CLIArgumentParser.parse should reject insufficient arguments", () => {
  const args = ["schema.json", "output.json"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InsufficientArguments");
    assertEquals(
      result.error.message,
      "Expected at least 3 arguments (schema, output, pattern/files), got 2",
    );
  }
});

Deno.test("CLIArgumentParser.parse should reject no arguments", () => {
  const args: string[] = [];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InsufficientArguments");
    assertEquals(
      result.error.message,
      "Expected at least 3 arguments (schema, output, pattern/files), got 0",
    );
  }
});

Deno.test("CLIArgumentParser.parse should propagate SchemaPath errors", () => {
  const args = ["schema.yaml", "output.json", "**/*.md"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidExtension");
  }
});

Deno.test("CLIArgumentParser.parse should propagate OutputPath errors", () => {
  const args = ["schema.json", "output.txt", "**/*.md"];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "UnsupportedFormat");
  }
});

Deno.test("CLIArgumentParser.parse should propagate InputPattern errors", () => {
  const args = ["schema.json", "output.json", ""];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyPattern");
  }
});

Deno.test("CLIArgumentParser.parse should handle multiple file arguments from shell expansion", () => {
  const args = [
    "schema.json",
    "output.json",
    "file1.md",
    "file2.md",
    "file3.md",
  ];
  const result = CLIArgumentParser.parse(args);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.schemaPath.toString(), "schema.json");
    assertEquals(result.data.outputPath.toString(), "output.json");
    assertEquals(
      result.data.inputPattern.toString(),
      "file1.md,file2.md,file3.md",
    );
    assertEquals(result.data.inputPattern.isMultiple(), true);
    assertEquals(result.data.inputPattern.getFiles(), [
      "file1.md",
      "file2.md",
      "file3.md",
    ]);
  }
});

Deno.test("CLIArgumentParser.getUsage should return usage text", () => {
  const usage = CLIArgumentParser.getUsage();
  assertExists(usage);
  assertEquals(usage.includes("Usage:"), true);
  assertEquals(usage.includes("frontmatter-to-schema"), true);
  assertEquals(usage.includes("fm2s"), true);
  assertEquals(usage.includes("Options:"), true);
  assertEquals(usage.includes("Examples:"), true);
});

Deno.test("CLIArgumentParser.getHelp should return help text", () => {
  const help = CLIArgumentParser.getHelp();
  assertExists(help);
  assertEquals(help.includes("FrontMatter to Schema"), true);
  assertEquals(help.includes("Description:"), true);
  assertEquals(help.includes("Features:"), true);
  assertEquals(help.includes("Usage:"), true);
  assertEquals(help.includes("github.com"), true);
});

Deno.test("CLIArgumentParser.getHelp should include usage text", () => {
  const help = CLIArgumentParser.getHelp();
  const usage = CLIArgumentParser.getUsage();
  assertEquals(help.includes(usage), true);
});
