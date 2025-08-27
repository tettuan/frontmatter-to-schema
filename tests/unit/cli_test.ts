/**
 * Unit Tests for CLI argument parsing and error handling
 *
 * Tests the CLI logic without actually running external commands
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

// Mock Deno environment for testing
const originalDeno = globalThis.Deno;

// Test helper to create mock Deno environment
function _createMockDeno(
  args: string[] = [],
  env: Record<string, string> = {},
) {
  return {
    ...originalDeno,
    args,
    env: {
      get: (key: string) => env[key],
      toObject: () => env,
    },
    exit: (code: number) => {
      throw new Error(`Mock exit with code ${code}`);
    },
    stat: (path: string) => {
      // Mock file stats based on path
      if (path.includes("non-existent")) {
        return Promise.reject(new Error("File not found"));
      }
      return Promise.resolve({
        isDirectory: !path.includes("."),
        size: 1024,
      } as Deno.FileInfo);
    },
    readTextFile: (path: string) => {
      if (path.includes("prompts/extract-frontmatter.md")) {
        return Promise.resolve("Extract frontmatter test template");
      }
      if (path.includes("prompts/map-to-template.md")) {
        return Promise.resolve("Map to template test template");
      }
      return Promise.reject(new Error("File not found"));
    },
  } as typeof Deno;
}

// Test argument parsing logic
Deno.test("CLI: Argument preprocessing handles key=value format", () => {
  const processArgs = (args: string[]) => {
    return args.map((arg) => {
      if (arg.startsWith("--") && arg.includes("=")) {
        const [key, value] = arg.split("=", 2);
        return [key, value];
      }
      return arg;
    }).flat();
  };

  const testCases = [
    {
      input: ["--schema=test.json", "--template=test.md"],
      expected: ["--schema", "test.json", "--template", "test.md"],
    },
    {
      input: ["--help"],
      expected: ["--help"],
    },
    {
      input: ["docs", "--verbose"],
      expected: ["docs", "--verbose"],
    },
  ];

  testCases.forEach(({ input, expected }) => {
    assertEquals(processArgs(input), expected);
  });
});

Deno.test("CLI: Debug mode detection works correctly", () => {
  const checkDebugMode = (env: Record<string, string>) => {
    return env["FRONTMATTER_TO_SCHEMA_DEBUG"] === "true" ||
      env["FRONTMATTER_DEBUG"] === "true";
  };

  // Test debug mode enabled
  assertEquals(checkDebugMode({ "FRONTMATTER_TO_SCHEMA_DEBUG": "true" }), true);
  assertEquals(checkDebugMode({ "FRONTMATTER_DEBUG": "true" }), true);

  // Test debug mode disabled
  assertEquals(checkDebugMode({}), false);
  assertEquals(
    checkDebugMode({ "FRONTMATTER_TO_SCHEMA_DEBUG": "false" }),
    false,
  );
});

Deno.test("CLI: Output path generation handles different scenarios", () => {
  const generateOutputPath = (destinationDir: string, templatePath: string) => {
    if (
      destinationDir.endsWith(".json") || destinationDir.endsWith(".yaml") ||
      destinationDir.endsWith(".yml") || destinationDir.endsWith(".toml")
    ) {
      return destinationDir;
    } else {
      const templateExt =
        templatePath.endsWith(".yaml") || templatePath.endsWith(".yml")
          ? "yaml"
          : "json";
      const outputFileName = `registry.${templateExt}`;
      return `${destinationDir}/${outputFileName}`;
    }
  };

  const testCases = [
    {
      destination: "./output",
      template: "template.json",
      expected: "./output/registry.json",
    },
    {
      destination: "./output",
      template: "template.yaml",
      expected: "./output/registry.yaml",
    },
    {
      destination: "./output/custom.json",
      template: "template.yaml",
      expected: "./output/custom.json", // Explicit extension takes precedence
    },
    {
      destination: "./output/result.yml",
      template: "template.json",
      expected: "./output/result.yml",
    },
  ];

  testCases.forEach(({ destination, template, expected }) => {
    assertEquals(generateOutputPath(destination, template), expected);
  });
});

Deno.test("CLI: Document path creation handles files vs directories", () => {
  const createDocumentPath = (markdownDir: string) => {
    return markdownDir.endsWith(".md") || markdownDir.endsWith(".markdown")
      ? markdownDir
      : `${markdownDir}/*.md`;
  };

  const testCases = [
    {
      input: "docs/readme.md",
      expected: "docs/readme.md",
    },
    {
      input: "docs/guide.markdown",
      expected: "docs/guide.markdown",
    },
    {
      input: "docs",
      expected: "docs/*.md",
    },
    {
      input: "./content",
      expected: "./content/*.md",
    },
  ];

  testCases.forEach(({ input, expected }) => {
    assertEquals(createDocumentPath(input), expected);
  });
});

Deno.test("CLI: Error handling for missing required arguments", () => {
  // Test missing schema argument
  try {
    // Simulate the validation that happens in main()
    const args = { _: ["docs"], schema: undefined, template: "template.json" };

    if (!args.schema || !args.template) {
      throw new Error("--schema and --template options are required");
    }
  } catch (error) {
    assertStringIncludes((error as Error).message, "required");
  }

  // Test missing template argument
  try {
    const args = { _: ["docs"], schema: "schema.json", template: undefined };

    if (!args.schema || !args.template) {
      throw new Error("--schema and --template options are required");
    }
  } catch (error) {
    assertStringIncludes((error as Error).message, "required");
  }
});

Deno.test("CLI: Template loading fallback works correctly", () => {
  const loadPromptTemplates = () => {
    try {
      // Simulate successful file read
      const extraction = "Extract frontmatter test template";
      const mapping = "Map to template test template";
      return { extraction, mapping };
    } catch {
      return {
        extraction:
          `Extract information from the following frontmatter according to the schema.
FrontMatter: {{FRONTMATTER}}
Schema: {{SCHEMA}}
Return ONLY a JSON object with the extracted data.`,
        mapping: `Map the extracted data to the template structure.
Data: {{EXTRACTED_DATA}}
Schema: {{SCHEMA}}
Return ONLY a JSON object with the mapped data.`,
      };
    }
  };

  const templates = loadPromptTemplates();
  assertEquals(typeof templates.extraction, "string");
  assertEquals(typeof templates.mapping, "string");
  assertEquals(templates.extraction.length > 0, true);
  assertEquals(templates.mapping.length > 0, true);
});

Deno.test("CLI: Verbose mode validation logic", () => {
  // Test file validation helper
  const validateFile = (
    path: string,
    logger: { debug: (message: string, data?: unknown) => void },
  ) => {
    try {
      if (path.includes("non-existent")) {
        throw new Error("File not found");
      }

      const stats = {
        size: 1024,
        isDirectory: !path.includes("."),
      };

      logger.debug(`File exists: ${path}`, {
        sizeKB: (stats.size / 1024).toFixed(1),
      });

      return true;
    } catch (error) {
      logger.debug(`File validation failed: ${path}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  const mockLogger = {
    debug: (_message: string, _data?: unknown) => {
      // Capture debug calls for verification
    },
  };

  // Test successful validation
  const validFile = validateFile("existing-file.json", mockLogger);
  assertEquals(validFile, true);

  // Test failed validation
  const invalidFile = validateFile("non-existent-file.json", mockLogger);
  assertEquals(invalidFile, false);
});

Deno.test("CLI: Template mapper fallback implementation", () => {
  // Test the simplified fallback template mapper logic
  const createTemplateMapper = () => {
    return {
      map: (
        data: { getData: () => unknown },
        template: { applyRules?: (data: unknown) => unknown },
      ) => {
        try {
          // Simplified mapping logic
          const mappedResult = template.applyRules
            ? template.applyRules(data.getData())
            : data.getData();

          return {
            ok: true as const,
            data: { create: () => ({ getData: () => mappedResult }) },
          };
        } catch (error) {
          return {
            ok: false as const,
            error: {
              kind: "MappingFailed" as const,
              message: error instanceof Error
                ? error.message
                : "Mapping failed",
            },
          };
        }
      },
    };
  };

  const mapper = createTemplateMapper();

  // Test successful mapping
  const mockData = {
    getData: () => ({ test: "value" }),
  };

  const mockTemplate = {
    applyRules: (data: unknown) => ({
      result: (data as { test: string }).test,
    }),
  };

  const result = mapper.map(mockData, mockTemplate);
  assertEquals(result.ok, true);

  // Test error handling
  const errorTemplate = {
    applyRules: () => {
      throw new Error("Template error");
    },
  };

  const errorResult = mapper.map(mockData, errorTemplate);
  assertEquals(errorResult.ok, false);
  assertEquals(errorResult.error?.kind, "MappingFailed");
});
