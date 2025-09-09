/**
 * TypeScript Analyzer Tests - Testing $ref resolution and schema analysis
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1.0.9";
import { describe, it } from "jsr:@std/testing@1.0.8/bdd";
import { TypeScriptAnalyzer } from "./typescript-analyzer.ts";
import { FrontMatter } from "../models/entities.ts";
import { FrontMatterContent } from "../models/document-value-objects.ts";
import { Schema, SchemaId } from "../models/entities.ts";
import {
  SchemaDefinition,
  SchemaVersion,
} from "../models/schema-value-objects.ts";
import type {
  FileInfo,
  FileSystemRepository,
} from "../repositories/file-system-repository.ts";
import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";

// Mock FileSystemRepository for testing
class MockFileSystemRepository implements FileSystemRepository {
  private files: Map<string, string> = new Map();

  async readFile(
    path: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    await Promise.resolve(); // Satisfy linter
    const content = this.files.get(path);
    if (content !== undefined) {
      return { ok: true, data: content };
    }
    return {
      ok: false,
      error: {
        kind: "FileNotFound",
        path,
        message: `File not found: ${path}`,
      } as DomainError & { message: string },
    };
  }

  async writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    await Promise.resolve(); // Satisfy linter
    this.files.set(path, content);
    return { ok: true, data: undefined };
  }

  async deleteFile(
    path: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    await Promise.resolve(); // Satisfy linter
    this.files.delete(path);
    return { ok: true, data: undefined };
  }

  async exists(
    path: string,
  ): Promise<Result<boolean, DomainError & { message: string }>> {
    await Promise.resolve(); // Satisfy linter
    return { ok: true, data: this.files.has(path) };
  }

  async ensureDirectory(
    _path: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    await Promise.resolve(); // Satisfy linter
    // Mock implementation - directories are implicit
    return { ok: true, data: undefined };
  }

  async *findFiles(pattern: string): AsyncIterable<string> {
    // Simple glob pattern matching for tests
    const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."));
    for (const filePath of this.files.keys()) {
      if (regex.test(filePath)) {
        yield filePath;
      }
    }
  }

  async stat(
    path: string,
  ): Promise<Result<FileInfo, DomainError & { message: string }>> {
    await Promise.resolve(); // Satisfy linter
    if (this.files.has(path)) {
      return {
        ok: true,
        data: {
          isFile: true,
          isDirectory: false,
          size: this.files.get(path)?.length || 0,
          mtime: new Date(),
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: "FileNotFound",
        path,
        message: `File not found: ${path}`,
      } as DomainError & { message: string },
    };
  }
}

describe("TypeScriptAnalyzer", () => {
  describe("analyze with $ref resolution", () => {
    it("should analyze frontmatter with simple schema", async () => {
      // Arrange
      const fileSystem = new MockFileSystemRepository();
      const analyzer = new TypeScriptAnalyzer(fileSystem);

      const frontMatterContentResult = FrontMatterContent.fromObject({
        title: "Test Document",
        version: "1.0.0",
        description: "Test description",
      });

      if (!frontMatterContentResult.ok) {
        throw new Error("Failed to create FrontMatterContent");
      }

      const frontMatter = FrontMatter.create(
        frontMatterContentResult.data,
        "---\ntitle: Test Document\nversion: 1.0.0\ndescription: Test description\n---",
      );

      const schemaDefinitionResult = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
          version: { type: "string" },
          description: { type: "string" },
        },
      });

      if (!schemaDefinitionResult.ok) {
        throw new Error("Failed to create schema definition");
      }

      const schemaIdResult = SchemaId.create("test-schema");
      if (!schemaIdResult.ok) {
        throw new Error("Failed to create schema ID");
      }

      const schemaVersionResult = SchemaVersion.create("1.0.0");
      if (!schemaVersionResult.ok) {
        throw new Error("Failed to create schema version");
      }

      const schema = Schema.create(
        schemaIdResult.data,
        schemaDefinitionResult.data,
        schemaVersionResult.data,
        "Test schema",
      );

      // Act
      const result = await analyzer.analyze(frontMatter, schema);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const extractedData = result.data;
        assertExists(extractedData);
        const json = extractedData.toJSON();
        assertEquals(json.title, "Test Document");
        assertEquals(json.version, "1.0.0");
        assertEquals(json.description, "Test description");
      }
    });

    it("should resolve $ref to external file", async () => {
      // Arrange
      const fileSystem = new MockFileSystemRepository();

      // Add referenced schema file
      await fileSystem.writeFile(
        "registry_command_schema.json",
        JSON.stringify({
          type: "object",
          properties: {
            c1: { type: "string" },
            c2: { type: "string" },
            c3: { type: "string" },
          },
          required: ["c1", "c2", "c3"],
        }),
      );

      const analyzer = new TypeScriptAnalyzer(fileSystem);

      const frontMatterContentResult = FrontMatterContent.fromObject({
        version: "1.0.0",
        commands: [
          { c1: "git", c2: "commit", c3: "push" },
          { c1: "npm", c2: "install", c3: "run" },
        ],
      });

      if (!frontMatterContentResult.ok) {
        throw new Error("Failed to create FrontMatterContent");
      }

      const frontMatter = FrontMatter.create(
        frontMatterContentResult.data,
        "---\nversion: 1.0.0\ncommands:\n  - c1: git\n    c2: commit\n    c3: push\n  - c1: npm\n    c2: install\n    c3: run\n---",
      );

      const schemaDefinitionResult = SchemaDefinition.create({
        type: "object",
        properties: {
          version: { type: "string" },
          commands: {
            type: "array",
            items: { "$ref": "registry_command_schema.json" },
          },
        },
      });

      if (!schemaDefinitionResult.ok) {
        throw new Error("Failed to create schema definition");
      }

      const schemaIdResult = SchemaId.create("test-schema-with-ref");
      if (!schemaIdResult.ok) {
        throw new Error("Failed to create schema ID");
      }

      const schemaVersionResult = SchemaVersion.create("1.0.0");
      if (!schemaVersionResult.ok) {
        throw new Error("Failed to create schema version");
      }

      const schema = Schema.create(
        schemaIdResult.data,
        schemaDefinitionResult.data,
        schemaVersionResult.data,
        "Schema with $ref",
      );

      // Act
      const result = await analyzer.analyze(frontMatter, schema);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const extractedData = result.data;
        assertExists(extractedData);
        const json = extractedData.toJSON();
        assertEquals(json.version, "1.0.0");
        assertEquals(Array.isArray(json.commands), true);
        const commands = json.commands as unknown[];
        assertEquals(commands.length, 2);
        assertEquals((commands[0] as Record<string, unknown>).c1, "git");
        assertEquals((commands[1] as Record<string, unknown>).c1, "npm");
      }
    });

    it("should fail on circular $ref", async () => {
      // Arrange
      const fileSystem = new MockFileSystemRepository();

      // Create circular reference
      await fileSystem.writeFile(
        "schema_a.json",
        JSON.stringify({
          type: "object",
          properties: {
            b: { "$ref": "schema_b.json" },
          },
        }),
      );

      await fileSystem.writeFile(
        "schema_b.json",
        JSON.stringify({
          type: "object",
          properties: {
            a: { "$ref": "schema_a.json" },
          },
        }),
      );

      const analyzer = new TypeScriptAnalyzer(fileSystem);

      const frontMatterContentResult = FrontMatterContent.fromObject({
        circular: { b: { a: {} } },
      });

      if (!frontMatterContentResult.ok) {
        throw new Error("Failed to create FrontMatterContent");
      }

      const frontMatter = FrontMatter.create(
        frontMatterContentResult.data,
        "---\ncircular:\n  b:\n    a: {}\n---",
      );

      const schemaDefinitionResult = SchemaDefinition.create({
        type: "object",
        properties: {
          circular: { "$ref": "schema_a.json" },
        },
      });

      if (!schemaDefinitionResult.ok) {
        throw new Error("Failed to create schema definition");
      }

      const schemaIdResult = SchemaId.create("circular-ref-schema");
      if (!schemaIdResult.ok) {
        throw new Error("Failed to create schema ID");
      }

      const schemaVersionResult = SchemaVersion.create("1.0.0");
      if (!schemaVersionResult.ok) {
        throw new Error("Failed to create schema version");
      }

      const schema = Schema.create(
        schemaIdResult.data,
        schemaDefinitionResult.data,
        schemaVersionResult.data,
        "Circular $ref schema",
      );

      // Act
      const result = await analyzer.analyze(frontMatter, schema);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertExists(result.error.message);
        assertEquals(result.error.message.includes("Circular reference"), true);
      }
    });

    it("should fail on missing $ref file", async () => {
      // Arrange
      const fileSystem = new MockFileSystemRepository();
      const analyzer = new TypeScriptAnalyzer(fileSystem);

      const frontMatterContentResult = FrontMatterContent.fromObject({
        data: "test",
      });

      if (!frontMatterContentResult.ok) {
        throw new Error("Failed to create FrontMatterContent");
      }

      const frontMatter = FrontMatter.create(
        frontMatterContentResult.data,
        "---\ndata: test\n---",
      );

      const schemaDefinitionResult = SchemaDefinition.create({
        type: "object",
        properties: {
          data: { "$ref": "non_existent_schema.json" },
        },
      });

      if (!schemaDefinitionResult.ok) {
        throw new Error("Failed to create schema definition");
      }

      const schemaIdResult = SchemaId.create("missing-ref-schema");
      if (!schemaIdResult.ok) {
        throw new Error("Failed to create schema ID");
      }

      const schemaVersionResult = SchemaVersion.create("1.0.0");
      if (!schemaVersionResult.ok) {
        throw new Error("Failed to create schema version");
      }

      const schema = Schema.create(
        schemaIdResult.data,
        schemaDefinitionResult.data,
        schemaVersionResult.data,
        "Missing $ref schema",
      );

      // Act
      const result = await analyzer.analyze(frontMatter, schema);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertExists(result.error.message);
        assertEquals(
          result.error.message.includes("not found") ||
            result.error.message.includes("Failed to resolve"),
          true,
        );
      }
    });
  });
});
