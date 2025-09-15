import { assertEquals } from "https://deno.land/std@0.202.0/testing/asserts.ts";
import { CLIArguments } from "../../../../src/presentation/cli/value-objects/cli-arguments.ts";

Deno.test("CLIArguments - Smart Constructor Tests", async (t) => {
  await t.step("should create valid CLI arguments", () => {
    const result = CLIArguments.create([
      "schema.json",
      "input.md",
      "output.json",
    ]);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.schemaPath, "schema.json");
      assertEquals(result.data.inputPattern, "input.md");
      assertEquals(result.data.outputPath, "output.json");
      assertEquals(result.data.verbose, false);
    }
  });

  await t.step("should handle verbose flag", () => {
    const result = CLIArguments.create([
      "schema.json",
      "input.md",
      "output.json",
      "--verbose",
    ]);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.verbose, true);
    }
  });

  await t.step("should reject missing arguments", () => {
    const result = CLIArguments.create(["schema.json", "input.md"]);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "MissingRequired");
      if (result.error.kind === "MissingRequired") {
        assertEquals(result.error.field, "arguments");
      }
    }
  });

  await t.step("should reject too many arguments", () => {
    const result = CLIArguments.create([
      "schema.json",
      "input.md",
      "output.json",
      "extra",
    ]);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "TooManyArguments");
    }
  });

  await t.step("should reject non-JSON schema files", () => {
    const result = CLIArguments.create([
      "schema.txt",
      "input.md",
      "output.json",
    ]);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
      if (result.error.kind === "InvalidFormat" && "field" in result.error) {
        assertEquals(result.error.field, "schemaPath");
      }
    }
  });

  await t.step("should reject invalid output format", () => {
    const result = CLIArguments.create([
      "schema.json",
      "input.md",
      "output.txt",
    ]);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
      if (result.error.kind === "InvalidFormat" && "field" in result.error) {
        assertEquals(result.error.field, "outputPath");
      }
    }
  });

  await t.step("should detect directory patterns", () => {
    const result = CLIArguments.create(["schema.json", "docs/", "output.json"]);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isDirectoryPattern(), true);
      assertEquals(result.data.isGlobPattern(), false);
      assertEquals(result.data.getExpandedPattern(), "docs/**/*.md");
    }
  });

  await t.step("should detect glob patterns", () => {
    const result = CLIArguments.create([
      "schema.json",
      "**/*.md",
      "output.json",
    ]);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isDirectoryPattern(), false);
      assertEquals(result.data.isGlobPattern(), true);
      assertEquals(result.data.getExpandedPattern(), "**/*.md");
    }
  });

  await t.step("should generate helpful suggestions", () => {
    const suggestions = CLIArguments.generateHelpSuggestions([]);

    assertEquals(suggestions.length > 0, true);
    assertEquals(suggestions[0], "Try: frontmatter-to-schema --help");
  });
});
