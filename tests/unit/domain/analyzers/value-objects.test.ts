/**
 * Tests for TypeScript Analyzer Value Objects
 * Following Totality principles - all edge cases covered
 */

import { assert, assertEquals, assertFalse } from "jsr:@std/assert";
import {
  AnalysisContext,
  RegistryCommand,
  RegistryData,
  RegistryVersion,
  ToolConfiguration,
} from "../../../../src/domain/analyzers/value-objects.ts";

Deno.test("RegistryVersion Value Object", async (t) => {
  await t.step("should create valid semantic version", () => {
    const result = RegistryVersion.create("1.0.0");
    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.getValue(), "1.0.0");
      assertEquals(result.data.toString(), "1.0.0");
    }
  });

  await t.step("should accept multi-digit version numbers", () => {
    const testCases = ["10.20.30", "0.0.1", "999.999.999"];
    for (const version of testCases) {
      const result = RegistryVersion.create(version);
      assert(result.ok, `Should accept version: ${version}`);
      if (result.ok) {
        assertEquals(result.data.getValue(), version);
      }
    }
  });

  await t.step("should reject invalid version formats", () => {
    const invalidCases = [
      "1.0", // Missing patch version
      "1", // Only major version
      "1.0.0.0", // Too many parts
      "v1.0.0", // Has prefix
      "1.0.0-alpha", // Has suffix
      "a.b.c", // Non-numeric
      "", // Empty
      "1..0", // Double dot
      ".1.0.0", // Leading dot
      "1.0.0.", // Trailing dot
    ];

    for (const invalid of invalidCases) {
      const result = RegistryVersion.create(invalid);
      assertFalse(result.ok, `Should reject version: ${invalid}`);
      if (!result.ok) {
        assert(result.error.message.includes("Invalid version format"));
      }
    }
  });

  await t.step("should create default version", () => {
    const version = RegistryVersion.createDefault();
    assertEquals(version.getValue(), "1.0.0");
    assertEquals(version.toString(), "1.0.0");
  });
});

Deno.test("ToolConfiguration Value Object", async (t) => {
  await t.step("should create valid tool configurations", () => {
    const validTools = [
      "git",
      "spec",
      "test",
      "code",
      "docs",
      "meta",
      "build",
      "refactor",
      "debug",
    ];

    for (const toolName of validTools) {
      const result = ToolConfiguration.create(toolName);
      assert(result.ok, `Should accept tool: ${toolName}`);
      if (result.ok) {
        assertEquals(result.data.getName(), toolName.toLowerCase());
        assertEquals(result.data.isEnabled(), true);
      }
    }
  });

  await t.step("should normalize tool names to lowercase", () => {
    const testCases = [
      ["GIT", "git"],
      ["Test", "test"],
      ["BUILD", "build"],
      ["ReFaCtOr", "refactor"],
    ];

    for (const [input, expected] of testCases) {
      const result = ToolConfiguration.create(input);
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.getName(), expected);
      }
    }
  });

  await t.step("should reject empty tool names", () => {
    const emptyCases = ["", " ", "  ", "\t", "\n"];

    for (const empty of emptyCases) {
      const result = ToolConfiguration.create(empty);
      assertFalse(result.ok);
      if (!result.ok) {
        assert(result.error.message.includes("Tool name cannot be empty"));
      }
    }
  });

  await t.step("should reject invalid tool names", () => {
    const invalidTools = [
      "invalid",
      "unknown",
      "custom",
      "123",
      "git-flow", // Has hyphen
      "test_tool", // Has underscore
    ];

    for (const invalid of invalidTools) {
      const result = ToolConfiguration.create(invalid);
      assertFalse(result.ok);
      if (!result.ok) {
        assert(result.error.message.includes("Invalid tool name"));
        assert(result.error.message.includes("Valid tools:"));
      }
    }
  });
});

Deno.test("RegistryCommand Value Object", async (t) => {
  await t.step("should create valid command", () => {
    const result = RegistryCommand.create(
      "git",
      "merge",
      "develop",
      "Merge develop branch",
    );
    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.getC1(), "git");
      assertEquals(result.data.getC2(), "merge");
      assertEquals(result.data.getC3(), "develop");
      assertEquals(result.data.getDescription(), "Merge develop branch");
    }
  });

  await t.step("should trim whitespace from inputs", () => {
    const result = RegistryCommand.create(
      "  git  ",
      "  merge  ",
      "  develop  ",
      "  Merge develop branch  ",
    );
    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.getC1(), "git");
      assertEquals(result.data.getC2(), "merge");
      assertEquals(result.data.getC3(), "develop");
      assertEquals(result.data.getDescription(), "Merge develop branch");
    }
  });

  await t.step("should convert to JSON correctly", () => {
    const result = RegistryCommand.create(
      "test",
      "unit",
      "coverage",
      "Run unit tests with coverage",
    );
    assert(result.ok);
    if (result.ok) {
      const json = result.data.toJSON();
      assertEquals(json.c1, "test");
      assertEquals(json.c2, "unit");
      assertEquals(json.c3, "coverage");
      assertEquals(json.description, "Run unit tests with coverage");
    }
  });

  await t.step("should reject empty command components", () => {
    const testCases = [
      ["", "merge", "develop", "desc"],
      ["git", "", "develop", "desc"],
      ["git", "merge", "", "desc"],
      ["", "", "", "desc"],
    ];

    for (const [c1, c2, c3, desc] of testCases) {
      const result = RegistryCommand.create(c1, c2, c3, desc);
      assertFalse(result.ok);
      if (!result.ok) {
        assert(result.error.message.includes("Command components"));
        assert(result.error.message.includes("cannot be empty"));
      }
    }
  });

  await t.step("should reject empty description", () => {
    const emptyDescriptions = ["", " ", "  ", "\t", "\n"];

    for (const desc of emptyDescriptions) {
      const result = RegistryCommand.create("git", "merge", "develop", desc);
      assertFalse(result.ok);
      if (!result.ok) {
        assert(
          result.error.message.includes("Command description cannot be empty"),
        );
      }
    }
  });

  await t.step("should create command from valid path", () => {
    const testCases = [
      {
        path:
          ".agent/climpt/prompts/git/merge-cleanup/develop-branches/f_default.md",
        expectedC1: "git",
        expectedC2: "merge-cleanup",
        expectedC3: "develop-branches",
      },
      {
        path: "path/to/prompts/test/unit/coverage/file.md",
        expectedC1: "test",
        expectedC2: "unit",
        expectedC3: "coverage",
      },
      {
        path: "prompts/build/robust/code/something.txt",
        expectedC1: "build",
        expectedC2: "robust",
        expectedC3: "code",
      },
    ];

    for (const testCase of testCases) {
      const result = RegistryCommand.createFromPath(
        testCase.path,
        "Test description",
      );
      assert(result.ok, `Should extract from path: ${testCase.path}`);
      if (result.ok) {
        assertEquals(result.data.getC1(), testCase.expectedC1);
        assertEquals(result.data.getC2(), testCase.expectedC2);
        assertEquals(result.data.getC3(), testCase.expectedC3);
      }
    }
  });

  await t.step("should handle paths without prompts directory", () => {
    const path = "git/merge/develop/file.md";
    const result = RegistryCommand.createFromPath(path, "Test description");
    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.getC1(), "git");
      assertEquals(result.data.getC2(), "merge");
      assertEquals(result.data.getC3(), "develop");
    }
  });

  await t.step("should reject paths with insufficient components", () => {
    const invalidPaths = [
      "prompts/git/file.md", // Only 1 component after prompts
      "prompts/git/merge/file.md", // Only 2 components
      "prompts/file.md", // No components
      "file.md", // No path
      "", // Empty
    ];

    for (const path of invalidPaths) {
      const result = RegistryCommand.createFromPath(path, "Test description");
      assertFalse(result.ok, `Should reject path: ${path}`);
      if (!result.ok) {
        assert(
          result.error.message.includes("Cannot extract command from path"),
        );
      }
    }
  });
});

Deno.test("AnalysisContext Value Object", async (t) => {
  await t.step("should create valid analysis context", () => {
    const result = AnalysisContext.create(
      "/path/to/document.md",
      { title: "Test", author: "John" },
      { type: "object", properties: {} },
      { format: "json" },
    );
    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.getDocumentPath(), "/path/to/document.md");
      assertEquals(result.data.getFrontMatterData().title, "Test");
      assertEquals(result.data.getSchemaData().type, "object");
      assertEquals(result.data.getTemplateData().format, "json");
    }
  });

  await t.step("should accept minimal valid data", () => {
    const result = AnalysisContext.create(
      "doc.md",
      { key: "value" }, // Minimal frontmatter
      {}, // Empty schema is allowed
      {}, // Empty template is allowed
    );
    assert(result.ok);
    if (result.ok) {
      assertEquals(result.data.getDocumentPath(), "doc.md");
      assertEquals(Object.keys(result.data.getFrontMatterData()).length, 1);
    }
  });

  await t.step("should reject empty document path", () => {
    // Note: Current implementation only rejects truly empty string, not whitespace
    const result = AnalysisContext.create(
      "",
      { title: "Test" },
      {},
      {},
    );
    assertFalse(result.ok);
    if (!result.ok) {
      assert(result.error.message.includes("Document path cannot be empty"));
    }
  });

  await t.step("should accept whitespace-only paths (current behavior)", () => {
    // Current implementation doesn't trim, so whitespace paths are allowed
    // This documents the actual behavior
    const whitespacePaths = [" ", "  ", "\t", "\n"];

    for (const path of whitespacePaths) {
      const result = AnalysisContext.create(
        path,
        { title: "Test" },
        {},
        {},
      );
      assert(
        result.ok,
        `Whitespace path "${path}" should be accepted (current behavior)`,
      );
    }
  });

  await t.step("should reject empty frontmatter data", () => {
    const result = AnalysisContext.create(
      "/path/to/doc.md",
      {}, // Empty frontmatter
      { type: "object" },
      { format: "json" },
    );
    assertFalse(result.ok);
    if (!result.ok) {
      assert(result.error.message.includes("FrontMatter data cannot be empty"));
    }
  });

  await t.step("should reject null frontmatter data", () => {
    const result = AnalysisContext.create(
      "/path/to/doc.md",
      null as unknown as Record<string, unknown>,
      { type: "object" },
      { format: "json" },
    );
    assertFalse(result.ok);
    if (!result.ok) {
      assert(result.error.message.includes("FrontMatter data cannot be empty"));
    }
  });
});

Deno.test("RegistryData Value Object", async (t) => {
  await t.step("should create valid registry data", () => {
    const version = RegistryVersion.createDefault();
    const command1Result = RegistryCommand.create(
      "git",
      "merge",
      "develop",
      "Merge",
    );
    const command2Result = RegistryCommand.create(
      "test",
      "unit",
      "coverage",
      "Test",
    );

    assert(command1Result.ok);
    assert(command2Result.ok);

    if (command1Result.ok && command2Result.ok) {
      const registryData = RegistryData.create(
        version,
        "Registry description",
        ["config1", "config2"],
        [command1Result.data, command2Result.data],
      );

      assertEquals(registryData.getVersion().getValue(), "1.0.0");
      assertEquals(registryData.getDescription(), "Registry description");
      assertEquals(registryData.getAvailableConfigs(), ["config1", "config2"]);
      assertEquals(registryData.getCommands().length, 2);
    }
  });

  await t.step("should deduplicate and sort available configs", () => {
    const version = RegistryVersion.createDefault();
    const registryData = RegistryData.create(
      version,
      "Test",
      ["zebra", "apple", "banana", "apple", "zebra", "cherry"],
      [],
    );

    const configs = registryData.getAvailableConfigs();
    assertEquals(configs, ["apple", "banana", "cherry", "zebra"]);
  });

  await t.step("should handle empty commands list", () => {
    const version = RegistryVersion.createDefault();
    const registryData = RegistryData.create(
      version,
      "Empty commands",
      ["config"],
      [],
    );

    assertEquals(registryData.getCommands().length, 0);
    assertEquals(registryData.getAvailableConfigs(), ["config"]);
  });

  await t.step("should convert to JSON correctly", () => {
    const version = RegistryVersion.createDefault();
    const commandResult = RegistryCommand.create(
      "git",
      "merge",
      "develop",
      "Merge develop",
    );
    assert(commandResult.ok);

    if (commandResult.ok) {
      const registryData = RegistryData.create(
        version,
        "Test Registry",
        ["config1", "config2"],
        [commandResult.data],
      );

      const json = registryData.toJSON();
      assertEquals(json.version, "1.0.0");
      assertEquals(json.description, "Test Registry");

      const tools = json.tools as {
        availableConfigs: string[];
        commands: unknown[];
      };
      assertEquals(tools.availableConfigs, ["config1", "config2"]);
      assertEquals(tools.commands.length, 1);

      const cmd = tools.commands[0] as Record<string, string>;
      assertEquals(cmd.c1, "git");
      assertEquals(cmd.c2, "merge");
      assertEquals(cmd.c3, "develop");
      assertEquals(cmd.description, "Merge develop");
    }
  });

  await t.step("should preserve immutability of configs", () => {
    const version = RegistryVersion.createDefault();
    const originalConfigs = ["config1", "config2"];
    const registryData = RegistryData.create(
      version,
      "Test",
      originalConfigs,
      [],
    );

    // Modify original array
    originalConfigs.push("config3");

    // Registry data should not be affected
    assertEquals(registryData.getAvailableConfigs(), ["config1", "config2"]);
  });
});
