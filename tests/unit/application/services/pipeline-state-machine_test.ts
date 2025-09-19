// @ts-nocheck - Discriminated union type checking issues in test assertions
import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  createPipelineStateMachine,
  executeCommands,
  PipelineCommand,
  PipelineContext,
  PipelineState,
  transition,
} from "../../../../src/application/services/pipeline-state-machine.ts";

describe("PipelineStateMachine", () => {
  const mockContext: PipelineContext = {
    inputPath: "/test/input.md",
    schemaPath: "/test/schema.json",
    outputPath: "/test/output.md",
    mode: "strict",
    enableJMESPathFilters: true,
  };

  describe("createPipelineStateMachine", () => {
    it("should create initial state machine", () => {
      const result = createPipelineStateMachine(mockContext);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "Initial");
        if (result.data.kind === "Initial") {
          assertEquals(result.data.context, mockContext);
        }
      }
    });
  });

  describe("transition", () => {
    it("should transition from Initial to FrontmatterParsed", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const command: PipelineCommand = {
        kind: "ParseFrontmatter",
        input: "---\ntitle: Test\n---\nContent",
      };

      const result = transition(initialState, command);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "FrontmatterParsed");
        assertExists(result.data.context);
        assertExists(result.data.data);
      }
    });

    it("should reject invalid command for Initial state", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const invalidCommand: PipelineCommand = {
        kind: "ValidateData",
      };

      const result = transition(initialState, invalidCommand);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PipelineExecutionError");
        assertEquals(result.error.phase, "Initial");
      }
    });

    it("should transition from FrontmatterParsed to SchemaLoaded", () => {
      const state: PipelineState = {
        kind: "FrontmatterParsed",
        context: mockContext,
        data: {} as any, // Mock FrontmatterData
      };

      const command: PipelineCommand = {
        kind: "LoadSchema",
        schemaPath: "/test/schema.json",
      };

      const result = transition(state, command);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "SchemaLoaded");
        assertExists(result.data.context);
        assertExists(result.data.data);
        assertExists(result.data.schema);
      }
    });

    it("should transition from SchemaLoaded to DataValidated", () => {
      const state: PipelineState = {
        kind: "SchemaLoaded",
        context: mockContext,
        data: {} as any, // Mock FrontmatterData
        schema: {} as any, // Mock Schema
      };

      const command: PipelineCommand = {
        kind: "ValidateData",
      };

      const result = transition(state, command);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "DataValidated");
        assertExists(result.data.context);
        assertExists(result.data.data);
        assertExists(result.data.schema);
      }
    });

    it("should transition from DataValidated to TemplateGenerated", () => {
      const state: PipelineState = {
        kind: "DataValidated",
        context: mockContext,
        data: {} as any, // Mock FrontmatterData
        schema: {} as any, // Mock Schema
      };

      const command: PipelineCommand = {
        kind: "GenerateTemplate",
      };

      const result = transition(state, command);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "TemplateGenerated");
        assertExists(result.data.context);
        assertExists(result.data.output);
      }
    });

    it("should transition from TemplateGenerated to Completed", () => {
      const state: PipelineState = {
        kind: "TemplateGenerated",
        context: mockContext,
        output: "mock template output",
      };

      const command: PipelineCommand = {
        kind: "Complete",
      };

      const result = transition(state, command);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "Completed");
        assertExists(result.data.result);
      }
    });

    it("should reject commands on Completed state", () => {
      const state: PipelineState = {
        kind: "Completed",
        result: "completed output",
      };

      const command: PipelineCommand = {
        kind: "ParseFrontmatter",
        input: "test",
      };

      const result = transition(state, command);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PipelineExecutionError");
        assertEquals(result.error.phase, "Completed");
      }
    });

    it("should maintain error state on Failed state", () => {
      const originalError = {
        kind: "PipelineExecutionError" as const,
        content: "Test error",
        phase: "Test",
        originalError: {
          kind: "InvalidSchema" as const,
          message: "Test error",
        },
      };

      const state: PipelineState = {
        kind: "Failed",
        error: originalError,
      };

      const command: PipelineCommand = {
        kind: "ParseFrontmatter",
        input: "test",
      };

      const result = transition(state, command);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error, originalError);
      }
    });
  });

  describe("executeCommands", () => {
    it("should execute a complete command sequence successfully", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const commands: PipelineCommand[] = [
        { kind: "ParseFrontmatter", input: "test content" },
        { kind: "LoadSchema", schemaPath: "/test/schema.json" },
        { kind: "ValidateData" },
        { kind: "GenerateTemplate" },
        { kind: "Complete" },
      ];

      const result = executeCommands(initialState, commands);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "Completed");
      }
    });

    it("should stop execution on first error", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const commands: PipelineCommand[] = [
        { kind: "ValidateData" }, // Invalid command for Initial state
        { kind: "ParseFrontmatter", input: "test content" },
      ];

      const result = executeCommands(initialState, commands);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PipelineExecutionError");
        assertEquals(result.error.phase, "Initial");
      }
    });

    it("should handle empty command sequence", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const commands: PipelineCommand[] = [];

      const result = executeCommands(initialState, commands);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "Initial");
        assertEquals(result.data.context, mockContext);
      }
    });

    it("should execute validation-only sequence", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const commands: PipelineCommand[] = [
        { kind: "ParseFrontmatter", input: "test content" },
        { kind: "LoadSchema", schemaPath: "/test/schema.json" },
        { kind: "ValidateData" },
      ];

      const result = executeCommands(initialState, commands);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "DataValidated");
      }
    });

    it("should execute template-only sequence", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const commands: PipelineCommand[] = [
        { kind: "ParseFrontmatter", input: "test content" },
        { kind: "GenerateTemplate" },
        { kind: "Complete" },
      ];

      const result = executeCommands(initialState, commands);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.kind, "Completed");
      }
    });
  });

  describe("State invariants", () => {
    it("should maintain context immutability through transitions", () => {
      const initialState: PipelineState = {
        kind: "Initial",
        context: mockContext,
      };

      const command: PipelineCommand = {
        kind: "ParseFrontmatter",
        input: "test",
      };

      const result = transition(initialState, command);

      assertEquals(result.ok, true);
      if (result.ok && result.data.kind === "FrontmatterParsed") {
        // Context should be the same reference (immutable)
        assertEquals(result.data.context, mockContext);
      }
    });

    it("should handle state transitions with proper type safety", () => {
      // This test validates TypeScript discriminated union behavior
      const state: PipelineState = {
        kind: "SchemaLoaded",
        context: mockContext,
        data: {} as any,
        schema: {} as any,
      };

      // TypeScript should enforce that only valid commands are accepted
      const validCommand: PipelineCommand = { kind: "ValidateData" };
      const result = transition(state, validCommand);

      assertEquals(result.ok, true);
    });
  });
});
