import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { BuildRegistryUseCase } from "../../../src/application/use-cases/build-registry-use-case.ts";
import {
  FileReader,
  FileWriter,
} from "../../../src/infrastructure/filesystem/file-system.ts";
import type { DomainError, Result } from "../../../src/domain/core/result.ts";
import {
  type FrontMatter,
  FrontMatterExtractor,
} from "../../../src/domain/frontmatter/frontmatter-models.ts";
import {
  PromptFile,
  PromptList,
} from "../../../src/domain/services/prompt-models.ts";
import type { Command, Registry } from "../../../src/domain/core/types.ts";
// Removed unused AnalysisResult import

// Mock FileReader implementation
class MockFileReader extends FileReader {
  constructor(private mockFiles: PromptFile[] = []) {
    super();
  }

  override readDirectory(
    _path: string,
  ): Promise<Result<PromptList, DomainError & { message: string }>> {
    const list = new PromptList();
    this.mockFiles.forEach((file) => list.add(file));
    return Promise.resolve({ ok: true, data: list });
  }

  override readFile(
    _path: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    const file = this.mockFiles.find((f) => f.path === _path);
    return Promise.resolve({ ok: true, data: file ? file.content : "" });
  }

  override exists(_path: string): Promise<boolean> {
    return Promise.resolve(this.mockFiles.some((f) => f.path === _path));
  }

  setMockFiles(files: PromptFile[]) {
    this.mockFiles = files;
  }
}

// Mock FileWriter implementation
class MockFileWriter extends FileWriter {
  private writtenData: Record<string, unknown> = {};

  override writeJson(_path: string, _data: Registry): Promise<void> {
    this.writtenData[_path] = _data;
    return Promise.resolve();
  }

  override ensureDir(_path: string): Promise<void> {
    // Mock implementation - no-op
    return Promise.resolve();
  }

  getWrittenData(path: string): unknown {
    return this.writtenData[path];
  }

  getAllWrittenData(): Record<string, unknown> {
    return { ...this.writtenData };
  }

  clear() {
    this.writtenData = {};
  }
}

// Mock FrontMatterExtractor implementation
class MockFrontMatterExtractor extends FrontMatterExtractor {
  private shouldReturnFrontMatter = true;
  private mockFrontMatter: FrontMatter | null = null;

  override extract(content: string): FrontMatter | null {
    if (!this.shouldReturnFrontMatter) {
      return null;
    }

    if (this.mockFrontMatter) {
      return this.mockFrontMatter;
    }

    // Use parent's extraction logic
    return super.extract(content);
  }

  setReturnFrontMatter(value: boolean) {
    this.shouldReturnFrontMatter = value;
  }

  setMockFrontMatter(frontMatter: FrontMatter | null) {
    this.mockFrontMatter = frontMatter;
  }
}

// Mock analyzer that mimics the behavior expected by BuildRegistryUseCase
class MockAnalyzer {
  private shouldSucceed = true;
  private mockCommands: Command[] = [];

  analyze(
    _frontMatter: FrontMatter,
    filePath: string,
  ): Promise<{ isValid: boolean; commands: unknown[] }> {
    if (!this.shouldSucceed) {
      throw new Error("Analysis failed");
    }

    const commands = this.mockCommands.length > 0 ? this.mockCommands : [
      {
        c1: "git",
        c2: "create",
        c3: "issue",
        description: `Command from ${filePath}`,
      },
    ];

    // Return an object that matches what BuildRegistryUseCase expects
    return Promise.resolve({
      isValid: true,
      commands: commands,
    });
  }

  setShouldSucceed(value: boolean) {
    this.shouldSucceed = value;
  }

  setMockCommands(commands: Command[]) {
    this.mockCommands = commands;
  }
}

// Test helper functions
const createMockPromptFile = (
  filename: string,
  content: string,
): PromptFile => {
  return new PromptFile(`/test/${filename}`, content);
};

const createTestCommand = (
  c1: string,
  c2: string,
  c3: string,
  description: string,
): Command => ({
  c1,
  c2,
  c3,
  description,
});

Deno.test({
  name: "BuildRegistryUseCase",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async (t) => {
    let mockFileReader: MockFileReader;
    let mockFileWriter: MockFileWriter;
    let mockExtractor: MockFrontMatterExtractor;
    let mockAnalyzer: MockAnalyzer;
    let useCase: BuildRegistryUseCase;

    // Setup before each test step
    const setupMocks = () => {
      mockFileReader = new MockFileReader();
      mockFileWriter = new MockFileWriter();
      mockExtractor = new MockFrontMatterExtractor();
      mockAnalyzer = new MockAnalyzer();
      useCase = new BuildRegistryUseCase(
        mockFileReader,
        mockFileWriter,
        mockExtractor,
        { kind: "MockAnalyzer", analyzer: mockAnalyzer },
      );
    };

    await t.step(
      "should successfully build registry with valid prompts",
      async () => {
        setupMocks();

        const mockFiles = [
          createMockPromptFile(
            "test1.md",
            "---\ntitle: Test Command 1\ndescription: First test command\n---\nContent",
          ),
          createMockPromptFile(
            "test2.md",
            "---\ntitle: Test Command 2\ndescription: Second test command\n---\nContent",
          ),
        ];

        mockFileReader.setMockFiles(mockFiles);

        // Mock analyzer to return different commands for each file
        let callCount = 0;
        mockAnalyzer.analyze = (
          _frontMatter: FrontMatter,
          filePath: string,
        ) => {
          callCount++;
          const command = callCount === 1
            ? createTestCommand("git", "create", "issue", "Create an issue")
            : createTestCommand(
              "spec",
              "analyze",
              "requirements",
              "Analyze requirements",
            );

          return Promise.resolve({
            isValid: true,
            commands: [command],
            sourceFile: filePath,
            data: [command],
          });
        };

        const result = await useCase.execute(
          "/test/prompts",
          "/test/output/registry.json",
        );

        assert(result.ok);
        const registry = result.data;
        assertEquals(registry.version, "1.0.0");
        assertEquals(registry.tools.commands.length, 2);
        assertEquals(registry.tools.availableConfigs.includes("git"), true);
        assertEquals(registry.tools.availableConfigs.includes("spec"), true);

        // Verify file was written
        const writtenRegistry = mockFileWriter.getWrittenData(
          "/test/output/registry.json",
        ) as Registry;
        assertEquals(writtenRegistry.version, "1.0.0");
        assertEquals(writtenRegistry.tools.commands.length, 2);
      },
    );

    await t.step("should handle empty prompts directory", async () => {
      setupMocks();

      mockFileReader.setMockFiles([]);

      const result = await useCase.execute(
        "/test/empty",
        "/test/output/registry.json",
      );

      assert(result.ok);
      const registry = result.data;
      assertEquals(registry.version, "1.0.0");
      assertEquals(registry.tools.commands.length, 0);
      assertEquals(registry.tools.availableConfigs.length, 0);
    });

    await t.step("should skip files without frontmatter", async () => {
      setupMocks();

      const mockFiles = [
        createMockPromptFile(
          "valid.md",
          "---\ntitle: Valid Command\ndescription: Has frontmatter\n---\nContent",
        ),
        createMockPromptFile(
          "invalid.md",
          "Just plain content without frontmatter",
        ),
      ];

      mockFileReader.setMockFiles(mockFiles);

      // Make extractor return null for files without frontmatter
      const originalExtract = mockExtractor.extract;
      mockExtractor.extract = (content: string) => {
        if (content.includes("Just plain content")) {
          return null;
        }
        return originalExtract.call(mockExtractor, content);
      };

      mockAnalyzer.setMockCommands([
        createTestCommand("git", "create", "issue", "Valid command"),
      ]);

      const result = await useCase.execute(
        "/test/mixed",
        "/test/output/registry.json",
      );

      assert(result.ok);
      const registry = result.data;
      assertEquals(registry.tools.commands.length, 1);
      assertEquals(registry.tools.commands[0].description, "Valid command");
    });

    await t.step("should handle analysis errors gracefully", async () => {
      setupMocks();

      const mockFiles = [
        createMockPromptFile(
          "error.md",
          "---\ntitle: Error Command\ndescription: Will cause analysis error\n---\nContent",
        ),
        createMockPromptFile(
          "success.md",
          "---\ntitle: Success Command\ndescription: Will succeed\n---\nContent",
        ),
      ];

      mockFileReader.setMockFiles(mockFiles);

      // Make analyzer fail for error.md but succeed for success.md
      const originalAnalyze = mockAnalyzer.analyze;
      mockAnalyzer.analyze = (_frontMatter: FrontMatter, filePath: string) => {
        if (filePath.includes("error.md")) {
          throw new Error("Analysis failed for this file");
        }
        return originalAnalyze.call(mockAnalyzer, _frontMatter, filePath);
      };

      mockAnalyzer.setMockCommands([
        createTestCommand("spec", "validate", "syntax", "Success command"),
      ]);

      const result = await useCase.execute(
        "/test/mixed",
        "/test/output/registry.json",
      );

      // Should continue processing despite one file failing
      assert(result.ok);
      const registry = result.data;
      assertEquals(registry.tools.commands.length, 1);
      assertEquals(registry.tools.commands[0].c1, "spec");
    });

    await t.step("should handle invalid analysis results", async () => {
      setupMocks();

      const mockFiles = [
        createMockPromptFile(
          "invalid.md",
          "---\ntitle: Invalid Result\ndescription: Returns invalid result\n---\nContent",
        ),
        createMockPromptFile(
          "valid.md",
          "---\ntitle: Valid Result\ndescription: Returns valid result\n---\nContent",
        ),
      ];

      mockFileReader.setMockFiles(mockFiles);

      // Make analyzer return invalid result for invalid.md
      const originalAnalyze = mockAnalyzer.analyze;
      mockAnalyzer.analyze = (_frontMatter: FrontMatter, filePath: string) => {
        if (filePath.includes("invalid.md")) {
          // Return result with no valid commands
          return Promise.resolve({
            isValid: false,
            commands: [],
            sourceFile: filePath,
            data: [],
          });
        }
        return originalAnalyze.call(mockAnalyzer, _frontMatter, filePath);
      };

      mockAnalyzer.setMockCommands([
        createTestCommand("git", "status", "check", "Valid command"),
      ]);

      const result = await useCase.execute(
        "/test/mixed",
        "/test/output/registry.json",
      );

      // Should only include valid results
      assert(result.ok);
      const registry = result.data;
      assertEquals(registry.tools.commands.length, 1);
      assertEquals(registry.tools.commands[0].c2, "status");
    });

    await t.step("should sort commands and configs correctly", async () => {
      setupMocks();

      const mockFiles = [
        createMockPromptFile("z.md", "---\ntitle: Z Command\n---\nContent"),
        createMockPromptFile("a.md", "---\ntitle: A Command\n---\nContent"),
      ];

      mockFileReader.setMockFiles(mockFiles);

      // Return commands in different order to test sorting
      const _originalAnalyze = mockAnalyzer.analyze;
      mockAnalyzer.analyze = (_frontMatter: FrontMatter, filePath: string) => {
        if (filePath.includes("z.md")) {
          return Promise.resolve({
            isValid: true,
            commands: [
              createTestCommand("zulu", "zebra", "zone", "Z command"),
            ],
          });
        } else {
          return Promise.resolve({
            isValid: true,
            commands: [
              createTestCommand("alpha", "apple", "area", "A command"),
            ],
          });
        }
      };

      const result = await useCase.execute(
        "/test/sorting",
        "/test/output/registry.json",
      );

      // Should be sorted alphabetically
      assert(result.ok);
      const registry = result.data;
      assertEquals(registry.tools.availableConfigs[0], "alpha");
      assertEquals(registry.tools.availableConfigs[1], "zulu");
      assertEquals(registry.tools.commands[0].c1, "alpha");
      assertEquals(registry.tools.commands[1].c1, "zulu");
    });

    await t.step(
      "should handle multiple commands from single file",
      async () => {
        setupMocks();

        const mockFiles = [
          createMockPromptFile(
            "multi.md",
            "---\ntitle: Multi Command\ndescription: Multiple commands\n---\nContent",
          ),
        ];

        mockFileReader.setMockFiles(mockFiles);
        mockAnalyzer.setMockCommands([
          createTestCommand("git", "create", "issue", "First command"),
          createTestCommand("git", "close", "issue", "Second command"),
          createTestCommand("spec", "validate", "format", "Third command"),
        ]);

        const result = await useCase.execute(
          "/test/multi",
          "/test/output/registry.json",
        );

        assert(result.ok);
        const registry = result.data;
        assertEquals(registry.tools.commands.length, 3);
        assertEquals(registry.tools.availableConfigs.length, 2);
        assertEquals(registry.tools.availableConfigs.includes("git"), true);
        assertEquals(registry.tools.availableConfigs.includes("spec"), true);
      },
    );

    await t.step("should validate registry structure", async () => {
      setupMocks();

      const mockFiles = [
        createMockPromptFile(
          "test.md",
          "---\ntitle: Test\ndescription: Test command\n---\nContent",
        ),
      ];

      mockFileReader.setMockFiles(mockFiles);
      mockAnalyzer.setMockCommands([
        createTestCommand("test", "run", "unit", "Test command"),
      ]);

      const result = await useCase.execute(
        "/test/structure",
        "/test/output/registry.json",
      );

      // Validate registry structure
      assert(result.ok);
      const registry = result.data;
      assertEquals(typeof registry.version, "string");
      assertEquals(typeof registry.description, "string");
      assertEquals(Array.isArray(registry.tools.commands), true);
      assertEquals(Array.isArray(registry.tools.availableConfigs), true);

      // Validate command structure
      const command = registry.tools.commands[0];
      assertEquals(typeof command.c1, "string");
      assertEquals(typeof command.c2, "string");
      assertEquals(typeof command.c3, "string");
      assertEquals(typeof command.description, "string");
    });

    await t.step("should log processing information", async () => {
      setupMocks();

      const mockFiles = [
        createMockPromptFile(
          "logged.md",
          "---\ntitle: Logged Command\ndescription: Should be logged\n---\nContent",
        ),
      ];

      mockFileReader.setMockFiles(mockFiles);
      mockAnalyzer.setMockCommands([
        createTestCommand("log", "info", "debug", "Logged command"),
      ]);

      // Execute and verify it completes without throwing
      const result = await useCase.execute(
        "/test/logging",
        "/test/output/registry.json",
      );

      assert(result.ok);
      const registry = result.data;
      assertEquals(registry.tools.commands.length, 1);
      assertEquals(registry.tools.commands[0].c1, "log");

      // Verify registry was written to output file
      const writtenRegistry = mockFileWriter.getWrittenData(
        "/test/output/registry.json",
      );
      assertEquals(writtenRegistry !== undefined, true);
    });

    await t.step("should handle file reader errors", async () => {
      setupMocks();

      // Mock file reader that throws error
      class ErrorFileReader extends FileReader {
        override readDirectory(
          _path: string,
        ): Promise<Result<PromptList, DomainError & { message: string }>> {
          return Promise.resolve({
            ok: false,
            error: {
              kind: "ReadError",
              path: _path,
              details: "Failed to read directory",
              message: "Failed to read directory",
            } as DomainError & { message: string },
          });
        }
        override readFile(
          _path: string,
        ): Promise<Result<string, DomainError & { message: string }>> {
          return Promise.resolve({
            ok: false,
            error: {
              kind: "ReadError",
              path: _path,
              details: "Failed to read file",
              message: "Failed to read file",
            } as DomainError & { message: string },
          });
        }
        override exists(_path: string): Promise<boolean> {
          throw new Error("Failed to check existence");
        }
      }

      const errorFileReader = new ErrorFileReader();

      const errorUseCase = new BuildRegistryUseCase(
        errorFileReader,
        mockFileWriter,
        mockExtractor,
        { kind: "MockAnalyzer", analyzer: mockAnalyzer },
      );

      // Should return error result instead of throwing
      const result = await errorUseCase.execute(
        "/test/error",
        "/test/output/registry.json",
      );

      // Should return a failure result
      assert(!result.ok);
      assert(result.error.message.includes("Failed to read directory"));
    });

    await t.step("should handle file writer errors", async () => {
      setupMocks();

      const mockFiles = [
        createMockPromptFile(
          "test.md",
          "---\ntitle: Test\ndescription: Test command\n---\nContent",
        ),
      ];

      mockFileReader.setMockFiles(mockFiles);
      mockAnalyzer.setMockCommands([
        createTestCommand("test", "write", "error", "Test command"),
      ]);

      // Mock file writer that throws error
      class ErrorFileWriter extends FileWriter {
        override writeJson(_path: string, _data: Registry): Promise<void> {
          throw new Error("Failed to write file");
        }
        override ensureDir(_path: string): Promise<void> {
          throw new Error("Failed to create directory");
        }
      }

      const errorFileWriter = new ErrorFileWriter();

      const errorUseCase = new BuildRegistryUseCase(
        mockFileReader,
        errorFileWriter,
        mockExtractor,
        { kind: "MockAnalyzer", analyzer: mockAnalyzer },
      );

      // Should propagate the error
      await assertRejects(
        async () =>
          await errorUseCase.execute(
            "/test/write-error",
            "/test/output/registry.json",
          ),
        Error,
        "Failed to write file",
      );
    });
  },
});
