/**
 * ClaudeCLIService Tests - Robust Test Implementation
 *
 * Following DDD and Totality principles for external service testing
 * Addresses Issue #723: Test Coverage Below Target - CLI Services
 */

import { assertEquals, assertExists } from "@std/assert";
import { ClaudeCLIService } from "../../../../../src/application/climpt/services/claude-cli.service.ts";

Deno.test("ClaudeCLIService - Robust Test Suite", async (t) => {
  await t.step("Service Interface Implementation", async (t) => {
    await t.step("should implement ExternalAnalysisService interface", () => {
      const service = new ClaudeCLIService();
      assertExists(service, "Service instance should be created");
      assertEquals(
        typeof service.analyze,
        "function",
        "Should have analyze method",
      );
    });

    await t.step("should create multiple instances independently", () => {
      const service1 = new ClaudeCLIService();
      const service2 = new ClaudeCLIService();

      assertExists(service1, "First service instance should be created");
      assertExists(service2, "Second service instance should be created");
      assertEquals(
        service1 === service2,
        false,
        "Instances should be independent",
      );
    });
  });

  await t.step("analyze Method - Successful Scenarios", async (t) => {
    await t.step("should handle JSON response from Claude CLI", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test prompt for JSON response";

      // Mock successful claude command execution
      const originalCommand = Deno.Command;
      const mockJsonResponse = { result: "success", data: { key: "value" } };

      try {
        // Mock Deno.Command to simulate successful claude CLI call
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              // Simulate successful JSON response
              const jsonOutput = JSON.stringify(mockJsonResponse);
              return {
                stdout: new TextEncoder().encode(jsonOutput),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, true, "Result should be successful");
        if (result.ok) {
          assertEquals(
            result.data,
            mockJsonResponse,
            "Should parse JSON response correctly",
          );
        }
      } finally {
        // Restore original Deno.Command
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step(
      "should handle raw text response from Claude CLI",
      async () => {
        const service = new ClaudeCLIService();
        const prompt = "Test prompt for text response";

        const originalCommand = Deno.Command;
        const rawTextResponse = "This is a plain text response from Claude CLI";

        try {
          (Deno as unknown as Record<string, unknown>).Command =
            class MockCommand {
              constructor(
                public command: string,
                public options: Record<string, unknown>,
              ) {}

              output() {
                return {
                  stdout: new TextEncoder().encode(rawTextResponse),
                  stderr: new TextEncoder().encode(""),
                };
              }
            };

          const result = await service.analyze(prompt);

          assertEquals(result.ok, true, "Result should be successful");
          if (result.ok) {
            assertEquals(
              result.data,
              { raw: rawTextResponse },
              "Should wrap raw text in object",
            );
          }
        } finally {
          (Deno as unknown as Record<string, unknown>).Command =
            originalCommand;
        }
      },
    );

    await t.step("should handle empty prompt", async () => {
      const service = new ClaudeCLIService();

      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode("{}"),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze("");

        assertEquals(result.ok, true, "Should handle empty prompt");
        if (result.ok) {
          assertEquals(result.data, {}, "Should return empty object");
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step("should handle context parameter", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test with context";
      const context = { testKey: "testValue", number: 42 };

      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode('{"contextProcessed": true}'),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(prompt, context);

        assertEquals(result.ok, true, "Should handle context parameter");
        if (result.ok) {
          assertEquals(
            result.data,
            { contextProcessed: true },
            "Should process with context",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });
  });

  await t.step("analyze Method - Error Scenarios", async (t) => {
    await t.step("should handle temporary file creation failure", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test prompt";

      const originalMakeTempFile = Deno.makeTempFile;

      try {
        // Mock makeTempFile to throw error
        (Deno as unknown as Record<string, unknown>).makeTempFile = () => {
          return Promise.reject(
            new Error("Permission denied for temp file creation"),
          );
        };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, false, "Result should be failure");
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "AIServiceError",
            "Should be AIServiceError",
          );
          if (result.error.kind === "AIServiceError") {
            assertEquals(
              result.error.service,
              "ClaudeCLI",
              "Should identify ClaudeCLI service",
            );
          }
          assertEquals(
            result.error.message.includes("Failed to create temporary file"),
            true,
            "Should have descriptive error message",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).makeTempFile =
          originalMakeTempFile;
      }
    });

    await t.step("should handle Claude CLI stderr output", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test prompt with error";

      const originalCommand = Deno.Command;
      const errorMessage = "Claude CLI authentication failed";

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode(""),
                stderr: new TextEncoder().encode(errorMessage),
              };
            }
          };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, false, "Result should be failure");
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "AIServiceError",
            "Should be AIServiceError",
          );
          if (result.error.kind === "AIServiceError") {
            assertEquals(
              result.error.service,
              "ClaudeCLI",
              "Should identify ClaudeCLI service",
            );
          }
          assertEquals(
            result.error.message.includes(errorMessage),
            true,
            "Should include stderr message",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step(
      "should handle Claude CLI command execution failure",
      async () => {
        const service = new ClaudeCLIService();
        const prompt = "Test prompt";

        const originalCommand = Deno.Command;

        try {
          (Deno as unknown as Record<string, unknown>).Command =
            class MockCommand {
              constructor(
                public command: string,
                public options: Record<string, unknown>,
              ) {}

              output() {
                throw new Error("Command not found: claude");
              }
            };

          const result = await service.analyze(prompt);

          assertEquals(result.ok, false, "Result should be failure");
          if (!result.ok) {
            assertEquals(
              result.error.kind,
              "AIServiceError",
              "Should be AIServiceError",
            );
            if (result.error.kind === "AIServiceError") {
              assertEquals(
                result.error.service,
                "ClaudeCLI",
                "Should identify ClaudeCLI service",
              );
            }
            assertEquals(
              result.error.message.includes("Claude CLI execution failed"),
              true,
              "Should have execution error message",
            );
          }
        } finally {
          (Deno as unknown as Record<string, unknown>).Command =
            originalCommand;
        }
      },
    );

    await t.step("should handle file write permission errors", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test prompt";

      const originalWriteTextFile = Deno.writeTextFile;

      try {
        // Mock successful temp file creation but failed write
        (Deno as unknown as Record<string, unknown>).writeTextFile = () => {
          return Promise.reject(new Error("Permission denied"));
        };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, false, "Result should be failure");
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "AIServiceError",
            "Should be AIServiceError",
          );
          if (result.error.kind === "AIServiceError") {
            assertEquals(
              result.error.service,
              "ClaudeCLI",
              "Should identify ClaudeCLI service",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
      }
    });

    await t.step("should handle non-Error exceptions", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test prompt";

      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              throw "String-based exception";
            }
          };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, false, "Result should be failure");
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "AIServiceError",
            "Should be AIServiceError",
          );
          assertEquals(
            result.error.message.includes("String-based exception"),
            true,
            "Should handle non-Error exceptions",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });
  });

  await t.step("File Management and Cleanup", async (t) => {
    await t.step("should clean up temporary files on success", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test cleanup on success";

      let tempFileCreated: string | null = null;
      let tempFileRemoved: string | null = null;

      const originalMakeTempFile = Deno.makeTempFile;
      const originalRemove = Deno.remove;
      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).makeTempFile = (
          _options: Record<string, unknown>,
        ) => {
          tempFileCreated = "/tmp/test-temp-file.txt";
          return Promise.resolve(tempFileCreated);
        };

        (Deno as unknown as Record<string, unknown>).remove = (
          _path: string,
        ) => {
          tempFileRemoved = _path;
          return Promise.resolve();
        };

        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode('{"success": true}'),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, true, "Result should be successful");
        assertEquals(
          tempFileCreated,
          tempFileRemoved,
          "Temp file should be cleaned up",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).makeTempFile =
          originalMakeTempFile;
        (Deno as unknown as Record<string, unknown>).remove = originalRemove;
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step("should clean up temporary files on error", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test cleanup on error";

      let tempFileCreated: string | null = null;
      let tempFileRemoved: string | null = null;

      const originalMakeTempFile = Deno.makeTempFile;
      const originalRemove = Deno.remove;
      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).makeTempFile = (
          _options: Record<string, unknown>,
        ) => {
          tempFileCreated = "/tmp/test-temp-file-error.txt";
          return Promise.resolve(tempFileCreated);
        };

        (Deno as unknown as Record<string, unknown>).remove = (
          _path: string,
        ) => {
          tempFileRemoved = _path;
          return Promise.resolve();
        };

        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              throw new Error("Simulated command failure");
            }
          };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, false, "Result should be failure");
        assertEquals(
          tempFileCreated,
          tempFileRemoved,
          "Temp file should be cleaned up even on error",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).makeTempFile =
          originalMakeTempFile;
        (Deno as unknown as Record<string, unknown>).remove = originalRemove;
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step("should handle cleanup errors gracefully", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test cleanup error handling";

      const originalMakeTempFile = Deno.makeTempFile;
      const originalRemove = Deno.remove;
      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).makeTempFile = (
          _options: Record<string, unknown>,
        ) => {
          return Promise.resolve("/tmp/test-temp-file-cleanup-error.txt");
        };

        (Deno as unknown as Record<string, unknown>).remove = (
          _path: string,
        ) => {
          return Promise.reject(
            new Error("Cannot remove file - permission denied"),
          );
        };

        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode('{"result": "success"}'),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(prompt);

        // Should still succeed even if cleanup fails
        assertEquals(result.ok, true, "Should succeed even if cleanup fails");
        if (result.ok) {
          assertEquals(
            result.data,
            { result: "success" },
            "Should return correct data",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).makeTempFile =
          originalMakeTempFile;
        (Deno as unknown as Record<string, unknown>).remove = originalRemove;
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });
  });

  await t.step("Edge Cases and Robustness", async (t) => {
    await t.step("should handle large prompts", async () => {
      const service = new ClaudeCLIService();
      const largePrompt = "A".repeat(10000); // 10KB prompt

      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode(
                  '{"processed": "large-prompt"}',
                ),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(largePrompt);

        assertEquals(result.ok, true, "Should handle large prompts");
        if (result.ok) {
          assertEquals(
            result.data,
            { processed: "large-prompt" },
            "Should process large prompt",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step("should handle special characters in prompt", async () => {
      const service = new ClaudeCLIService();
      const specialPrompt =
        "Test with special chars: \n\t\r\"'\\`${}[]()!@#%^&*";

      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode('{"special": "handled"}'),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(specialPrompt);

        assertEquals(result.ok, true, "Should handle special characters");
        if (result.ok) {
          assertEquals(
            result.data,
            { special: "handled" },
            "Should process special characters",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step("should handle malformed JSON response", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test malformed JSON response";

      const originalCommand = Deno.Command;
      const malformedJson = '{"incomplete": json without closing brace';

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode(malformedJson),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, true, "Should handle malformed JSON");
        if (result.ok) {
          assertEquals(
            result.data,
            { raw: malformedJson },
            "Should return raw text for malformed JSON",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });

    await t.step("should handle empty Claude CLI response", async () => {
      const service = new ClaudeCLIService();
      const prompt = "Test empty response";

      const originalCommand = Deno.Command;

      try {
        (Deno as unknown as Record<string, unknown>).Command =
          class MockCommand {
            constructor(
              public command: string,
              public options: Record<string, unknown>,
            ) {}

            output() {
              return {
                stdout: new TextEncoder().encode(""),
                stderr: new TextEncoder().encode(""),
              };
            }
          };

        const result = await service.analyze(prompt);

        assertEquals(result.ok, true, "Should handle empty response");
        if (result.ok) {
          assertEquals(
            result.data,
            { raw: "" },
            "Should return empty raw string",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).Command = originalCommand;
      }
    });
  });

  await t.step("Command Invocation Verification", async (t) => {
    await t.step(
      "should invoke claude command with correct arguments",
      async () => {
        const service = new ClaudeCLIService();
        const prompt = "Test command arguments";

        let capturedCommand: string | null = null;
        let capturedArgs: string[] = [];

        const originalCommand = Deno.Command;

        try {
          (Deno as unknown as Record<string, unknown>).Command =
            class MockCommand {
              constructor(
                public command: string,
                public options: Record<string, unknown>,
              ) {
                capturedCommand = command;
                capturedArgs = options.args as string[];
              }

              output() {
                return {
                  stdout: new TextEncoder().encode('{"args": "verified"}'),
                  stderr: new TextEncoder().encode(""),
                };
              }
            };

          const result = await service.analyze(prompt);

          assertEquals(result.ok, true, "Should succeed");
          assertEquals(
            capturedCommand,
            "claude",
            "Should invoke claude command",
          );
          assertEquals(capturedArgs.length, 2, "Should have 2 arguments");
          assertEquals(capturedArgs[0], "-p", "Should use -p flag");
          assertEquals(
            typeof capturedArgs[1],
            "string",
            "Should have temp file path",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).Command =
            originalCommand;
        }
      },
    );
  });
});
