import { assertEquals, assertExists } from "jsr:@std/assert@1.0.8";
import { describe, it } from "jsr:@std/testing@1.0.5/bdd";
import { OutputRenderingService } from "../../../../../src/domain/template/services/output-rendering-service.ts";
import { TemplateRenderer } from "../../../../../src/domain/template/renderers/template-renderer.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ok, Result } from "../../../../../src/domain/shared/types/result.ts";
import { DomainError } from "../../../../../src/domain/shared/types/errors.ts";

// Mock implementations
class MockFileReader {
  constructor(private readonly fileContents: Record<string, string>) {}

  read(path: string): Result<string, DomainError & { message: string }> {
    const content = this.fileContents[path];
    if (content !== undefined) {
      return ok(content);
    }
    return {
      ok: false,
      error: { kind: "FileNotFound", path, message: `File not found: ${path}` },
    } as const;
  }
}

class MockFileWriter {
  public writtenFiles: Record<string, string> = {};

  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }> {
    this.writtenFiles[path] = content;
    return ok(undefined);
  }
}

describe("OutputRenderingService - Dual Format Template Support", () => {
  const createService = (fileContents: Record<string, string>) => {
    const templateRendererResult = TemplateRenderer.create();
    if (!templateRendererResult.ok) {
      throw new Error("Failed to create TemplateRenderer");
    }

    const mockFileReader = new MockFileReader(fileContents);
    const mockFileWriter = new MockFileWriter();

    const service = new OutputRenderingService(
      templateRendererResult.data,
      mockFileReader,
      mockFileWriter,
    );

    return { service, mockFileWriter };
  };

  describe("JSON Template Support", () => {
    it("should successfully parse and render JSON templates", () => {
      const jsonTemplate = JSON.stringify(
        {
          version: "{version}",
          description: "{description}",
          tools: {
            commands: ["{@items}"],
          },
        },
        null,
        2,
      );

      const itemTemplate = JSON.stringify({
        c1: "{c1}",
        c2: "{c2}",
        description: "{description}",
      });

      const { service, mockFileWriter } = createService({
        "template.json": jsonTemplate,
        "item-template.json": itemTemplate,
      });

      const mainData = FrontmatterData.create({
        version: "1.0.0",
        description: "Test registry",
      });

      const itemsData = [
        FrontmatterData.create({
          c1: "git",
          c2: "commit",
          description: "Git commit command",
        }),
        FrontmatterData.create({
          c1: "spec",
          c2: "analyze",
          description: "Spec analysis command",
        }),
      ];

      if (!mainData.ok) throw new Error("Failed to create main data");
      if (!itemsData[0].ok || !itemsData[1].ok) {
        throw new Error("Failed to create items data");
      }

      const result = service.renderOutput(
        "template.json",
        "item-template.json",
        mainData.data,
        [itemsData[0].data, itemsData[1].data],
        "output.json",
      );

      assertEquals(result.ok, true);
      assertExists(mockFileWriter.writtenFiles["output.json"]);

      // Verify the output contains expected structure
      const output = JSON.parse(mockFileWriter.writtenFiles["output.json"]);
      assertEquals(output.version, "1.0.0");
      assertEquals(output.description, "Test registry");
      assertEquals(Array.isArray(output.tools.commands), true);
    });
  });

  describe("YAML Template Support", () => {
    it("should successfully parse and render YAML templates", () => {
      const yamlTemplate = `version: "{version}"
description: "{description}"
tools:
  commands:
    - "{@items}"`;

      const itemTemplate = `c1: "{c1}"
c2: "{c2}"
description: "{description}"`;

      const { service, mockFileWriter } = createService({
        "template.yaml": yamlTemplate,
        "item-template.yaml": itemTemplate,
      });

      const mainData = FrontmatterData.create({
        version: "2.0.0",
        description: "YAML test registry",
      });

      const itemsData = [
        FrontmatterData.create({
          c1: "build",
          c2: "test",
          description: "Build test command",
        }),
      ];

      if (!mainData.ok) throw new Error("Failed to create main data");
      if (!itemsData[0].ok) throw new Error("Failed to create items data");

      const result = service.renderOutput(
        "template.yaml",
        "item-template.yaml",
        mainData.data,
        [itemsData[0].data],
        "output.yaml",
        "yaml",
      );

      assertEquals(result.ok, true);
      assertExists(mockFileWriter.writtenFiles["output.yaml"]);

      // Verify YAML output structure
      const output = mockFileWriter.writtenFiles["output.yaml"];
      assertEquals(output.includes("version: 2.0.0"), true);
      assertEquals(output.includes("description: YAML test registry"), true);
    });
  });

  describe("Mixed Format Support", () => {
    it("should handle JSON schema with YAML template", () => {
      const yamlTemplate = `name: "{name}"
type: "{type}"
items:
  - "{@items}"`;

      const jsonItemTemplate = JSON.stringify({
        id: "{id}",
        value: "{value}",
      });

      const { service, mockFileWriter } = createService({
        "main.yaml": yamlTemplate,
        "item.json": jsonItemTemplate,
      });

      const mainData = FrontmatterData.create({
        name: "Mixed Format Test",
        type: "hybrid",
      });

      const itemsData = [
        FrontmatterData.create({
          id: "item1",
          value: "test value",
        }),
      ];

      if (!mainData.ok) throw new Error("Failed to create main data");
      if (!itemsData[0].ok) throw new Error("Failed to create items data");

      const result = service.renderOutput(
        "main.yaml",
        "item.json",
        mainData.data,
        [itemsData[0].data],
        "mixed-output.yaml",
        "yaml",
      );

      assertEquals(result.ok, true);
      assertExists(mockFileWriter.writtenFiles["mixed-output.yaml"]);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid JSON template gracefully", () => {
      const { service } = createService({
        "invalid.json": "{ invalid: json: content: [missing bracket }",
      });

      const mainData = FrontmatterData.create({
        test: "data",
      });

      if (!mainData.ok) throw new Error("Failed to create test data");

      const result = service.renderOutput(
        "invalid.json",
        undefined,
        mainData.data,
        undefined,
        "output.json",
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTemplate");
      }
    });

    it("should handle invalid YAML template gracefully", () => {
      const { service } = createService({
        "invalid.yaml": "invalid: yaml: content: [missing bracket",
      });

      const mainData = FrontmatterData.create({
        test: "data",
      });

      if (!mainData.ok) throw new Error("Failed to create test data");

      const result = service.renderOutput(
        "invalid.yaml",
        undefined,
        mainData.data,
        undefined,
        "output.yaml",
      );

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTemplate");
      }
    });
  });
});
