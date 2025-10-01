import { assertEquals, assertExists } from "@std/assert";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { CLI } from "../../../../src/presentation/cli/index.ts";

describe("CLI", () => {
  describe("create", () => {
    it("should create CLI instance successfully", () => {
      const result = CLI.create();
      assertEquals(result.ok, true);
      assertExists(result.data);
      assertEquals(result.error, undefined);
    });
  });

  describe("run", () => {
    let cli: CLI;

    beforeEach(() => {
      const result = CLI.create();
      if (result.ok && result.data) {
        cli = result.data;
      }
    });

    describe("help command", () => {
      it("should show help for 'help' command", async () => {
        const response = await cli.run(["help"]);
        assertEquals(response.ok, true);
        assertExists(response.data);
        assertEquals(typeof response.data, "string");
        assertEquals(
          (response.data as string).includes("Frontmatter to Schema Processor"),
          true,
        );
      });

      it("should show help for '--help' flag", async () => {
        const response = await cli.run(["--help"]);
        assertEquals(response.ok, true);
        assertExists(response.data);
      });

      it("should show help for '-h' flag", async () => {
        const response = await cli.run(["-h"]);
        assertEquals(response.ok, true);
        assertExists(response.data);
      });

      it("should show help when no arguments provided", async () => {
        const response = await cli.run([]);
        assertEquals(response.ok, true);
        assertExists(response.data);
        assertEquals(typeof response.data, "string");
      });
    });

    describe("version command", () => {
      it("should show version for 'version' command", async () => {
        const response = await cli.run(["version"]);
        assertEquals(response.ok, true);
        assertExists(response.data);
        assertEquals(typeof response.data, "string");
      });

      it("should show version for '--version' flag", async () => {
        const response = await cli.run(["--version"]);
        assertEquals(response.ok, true);
        assertExists(response.data);
      });

      it("should show version for '-v' flag", async () => {
        const response = await cli.run(["-v"]);
        assertEquals(response.ok, true);
        assertExists(response.data);
      });
    });

    describe("unknown command", () => {
      it("should return error for unknown command", async () => {
        const response = await cli.run(["unknown"]);
        assertEquals(response.ok, false);
        assertExists(response.error);
        assertEquals(response.error?.code, "UNKNOWN_COMMAND");
        assertEquals(
          response.error?.message.includes("Unknown command: unknown"),
          true,
        );
      });
    });

    describe("process command", () => {
      it("should return error for insufficient arguments", async () => {
        const response = await cli.run(["process"]);
        assertEquals(response.ok, false);
        assertExists(response.error);
        assertEquals(response.error?.code, "INVALID_ARGUMENTS");
      });

      it("should return error with only one argument", async () => {
        const response = await cli.run(["process", "schema.json"]);
        assertEquals(response.ok, false);
        assertExists(response.error);
        assertEquals(response.error?.code, "INVALID_ARGUMENTS");
      });

      it("should return error with only two arguments", async () => {
        const response = await cli.run([
          "process",
          "schema.json",
          "template.json",
        ]);
        assertEquals(response.ok, false);
        assertExists(response.error);
        assertEquals(response.error?.code, "INVALID_ARGUMENTS");
      });

      it("should return error with only three arguments", async () => {
        const response = await cli.run([
          "process",
          "schema.json",
          "template.json",
          "input.md",
        ]);
        assertEquals(response.ok, false);
        assertExists(response.error);
        assertEquals(response.error?.code, "INVALID_ARGUMENTS");
        assertEquals(
          response.error?.message.includes("Insufficient arguments"),
          true,
        );
      });

      it("should parse valid process arguments with default format", async () => {
        const response = await cli.run([
          "process",
          "test_schema.json",
          "test_template.json",
          "test_input.md",
          "test_output.json",
        ]);

        // This will fail because the files don't exist, but it validates argument parsing
        assertEquals(response.ok, false);
        // The error should be about file not found, not invalid arguments
        assertEquals(response.error?.code !== "INVALID_ARGUMENTS", true);
      });

      it("should parse valid process arguments with yaml format", async () => {
        const response = await cli.run([
          "process",
          "test_schema.json",
          "test_template.json",
          "test_input.md",
          "test_output.yaml",
          "yaml",
        ]);

        // This will fail because the files don't exist, but it validates argument parsing
        assertEquals(response.ok, false);
        // The error should be about file not found, not invalid arguments
        assertEquals(response.error?.code !== "INVALID_ARGUMENTS", true);
      });
    });
  });

  describe("parseProcessArgs", () => {
    it("should validate argument count", () => {
      const result = CLI.create();
      if (!result.ok || !result.data) {
        throw new Error("Failed to create CLI");
      }
      const cli = result.data;

      // Access private method through reflection for testing
      const parseMethod = (cli as any).parseProcessArgs.bind(cli);

      const response1 = parseMethod([]);
      assertEquals(response1.ok, false);
      assertEquals(response1.error?.code, "INVALID_ARGUMENTS");

      const response2 = parseMethod(["schema.json"]);
      assertEquals(response2.ok, false);

      const response3 = parseMethod(["schema.json", "template.json"]);
      assertEquals(response3.ok, false);

      const response4 = parseMethod([
        "schema.json",
        "template.json",
        "input.md",
      ]);
      assertEquals(response4.ok, false);
    });

    it("should parse valid arguments correctly", () => {
      const result = CLI.create();
      if (!result.ok || !result.data) {
        throw new Error("Failed to create CLI");
      }
      const cli = result.data;

      const parseMethod = (cli as any).parseProcessArgs.bind(cli);

      const response = parseMethod([
        "schema.json",
        "template.json",
        "input.md",
        "output.json",
        "yaml",
      ]);

      assertEquals(response.ok, true);
      assertExists(response.data);
      assertEquals(response.data.schemaPath, "schema.json");
      assertEquals(response.data.templatePath, "template.json");
      assertEquals(response.data.inputPath, "input.md");
      assertEquals(response.data.outputPath, "output.json");
      assertEquals(response.data.outputFormat, "yaml");
    });

    it("should use default json format when not specified", () => {
      const result = CLI.create();
      if (!result.ok || !result.data) {
        throw new Error("Failed to create CLI");
      }
      const cli = result.data;

      const parseMethod = (cli as any).parseProcessArgs.bind(cli);

      const response = parseMethod([
        "schema.json",
        "template.json",
        "input.md",
        "output.json",
      ]);

      assertEquals(response.ok, true);
      assertExists(response.data);
      assertEquals(response.data.outputFormat, "json");
    });
  });

  describe("error handling", () => {
    it("should handle exceptions gracefully", async () => {
      const result = CLI.create();
      if (!result.ok || !result.data) {
        throw new Error("Failed to create CLI");
      }
      const cli = result.data;

      // Test with an invalid command that triggers error handling
      // Since we can't mock the internal method easily, we'll use a command
      // that we know returns an error
      const response = await cli.run(["invalid-command"]);
      assertEquals(response.ok, false);
      assertExists(response.error);
      assertEquals(response.error?.code, "UNKNOWN_COMMAND");
    });
  });
});
