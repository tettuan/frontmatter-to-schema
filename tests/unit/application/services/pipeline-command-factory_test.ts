import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  createCommandSequence,
  generateStandardSequence,
  generateTemplateOnlySequence,
  generateValidationOnlySequence,
  validateCommandSequence,
} from "../../../../src/application/services/pipeline-command-factory.ts";
import { PipelineContext } from "../../../../src/application/services/pipeline-state-machine.ts";

describe("PipelineCommandFactory", () => {
  const mockContext: PipelineContext = {
    inputPath: "/test/input.md",
    schemaPath: "/test/schema.json",
    outputPath: "/test/output.md",
    mode: "strict",
    enableJMESPathFilters: true,
  };

  const testInputContent = "---\ntitle: Test\n---\nContent";

  describe("generateStandardSequence", () => {
    it("should generate complete standard sequence", () => {
      const result = generateStandardSequence(mockContext, testInputContent);

      assertEquals(result.ok, true);
      if (result.ok) {
        const sequence = result.data;
        assertEquals(sequence.length, 5);
        assertEquals(sequence[0].kind, "ParseFrontmatter");
        assertEquals(sequence[1].kind, "LoadSchema");
        assertEquals(sequence[2].kind, "ValidateData");
        assertEquals(sequence[3].kind, "GenerateTemplate");
        assertEquals(sequence[4].kind, "Complete");

        // Check command details
        if (sequence[0].kind === "ParseFrontmatter") {
          assertEquals(sequence[0].input, testInputContent);
        }
        if (sequence[1].kind === "LoadSchema") {
          assertEquals(sequence[1].schemaPath, mockContext.schemaPath);
        }
      }
    });
  });

  describe("generateValidationOnlySequence", () => {
    it("should generate validation-only sequence", () => {
      const result = generateValidationOnlySequence(
        mockContext,
        testInputContent,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        const sequence = result.data;
        assertEquals(sequence.length, 3);
        assertEquals(sequence[0].kind, "ParseFrontmatter");
        assertEquals(sequence[1].kind, "LoadSchema");
        assertEquals(sequence[2].kind, "ValidateData");

        // Should not include template generation or completion
        const hasGenerateTemplate = sequence.some((cmd) =>
          cmd.kind === "GenerateTemplate"
        );
        const hasComplete = sequence.some((cmd) => cmd.kind === "Complete");
        assertEquals(hasGenerateTemplate, false);
        assertEquals(hasComplete, false);
      }
    });
  });

  describe("generateTemplateOnlySequence", () => {
    it("should generate template-only sequence", () => {
      const result = generateTemplateOnlySequence(
        mockContext,
        testInputContent,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        const sequence = result.data;
        assertEquals(sequence.length, 3);
        assertEquals(sequence[0].kind, "ParseFrontmatter");
        assertEquals(sequence[1].kind, "GenerateTemplate");
        assertEquals(sequence[2].kind, "Complete");

        // Should not include schema loading or validation
        const hasLoadSchema = sequence.some((cmd) => cmd.kind === "LoadSchema");
        const hasValidateData = sequence.some((cmd) =>
          cmd.kind === "ValidateData"
        );
        assertEquals(hasLoadSchema, false);
        assertEquals(hasValidateData, false);
      }
    });
  });

  describe("createCommandSequence", () => {
    it("should create standard sequence by default", () => {
      const result = createCommandSequence(mockContext, testInputContent);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 5);
        assertEquals(result.data[0].kind, "ParseFrontmatter");
        assertEquals(result.data[4].kind, "Complete");
      }
    });

    it("should create standard sequence when explicitly requested", () => {
      const result = createCommandSequence(
        mockContext,
        testInputContent,
        "standard",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 5);
      }
    });

    it("should create validation-only sequence when requested", () => {
      const result = createCommandSequence(
        mockContext,
        testInputContent,
        "validation-only",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 3);
        assertEquals(result.data[2].kind, "ValidateData");
      }
    });

    it("should create template-only sequence when requested", () => {
      const result = createCommandSequence(
        mockContext,
        testInputContent,
        "template-only",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 3);
        assertEquals(result.data[1].kind, "GenerateTemplate");
      }
    });
  });

  describe("validateCommandSequence", () => {
    it("should validate standard sequence", () => {
      const sequenceResult = generateStandardSequence(
        mockContext,
        testInputContent,
      );
      assertEquals(sequenceResult.ok, true);

      if (sequenceResult.ok) {
        const result = validateCommandSequence(
          sequenceResult.data,
          mockContext,
        );
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, true);
        }
      }
    });

    it("should validate validation-only sequence", () => {
      const sequenceResult = generateValidationOnlySequence(
        mockContext,
        testInputContent,
      );
      assertEquals(sequenceResult.ok, true);

      if (sequenceResult.ok) {
        const result = validateCommandSequence(
          sequenceResult.data,
          mockContext,
        );
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, true);
        }
      }
    });

    it("should validate template-only sequence", () => {
      const sequenceResult = generateTemplateOnlySequence(
        mockContext,
        testInputContent,
      );
      assertEquals(sequenceResult.ok, true);

      if (sequenceResult.ok) {
        const result = validateCommandSequence(
          sequenceResult.data,
          mockContext,
        );
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, true);
        }
      }
    });

    it("should reject sequence without ParseFrontmatter", () => {
      const invalidSequence = [
        { kind: "LoadSchema" as const, schemaPath: "/test/schema.json" },
        { kind: "ValidateData" as const },
      ];

      const result = validateCommandSequence(invalidSequence, mockContext);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
      }
    });

    it("should reject ValidateData without LoadSchema", () => {
      const invalidSequence = [
        { kind: "ParseFrontmatter" as const, input: "test" },
        { kind: "ValidateData" as const },
      ];

      const result = validateCommandSequence(invalidSequence, mockContext);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(
          result.error.message.includes(
            "ValidateData command requires LoadSchema",
          ),
          true,
        );
      }
    });

    it("should reject Complete without GenerateTemplate", () => {
      const invalidSequence = [
        { kind: "ParseFrontmatter" as const, input: "test" },
        { kind: "Complete" as const },
      ];

      const result = validateCommandSequence(invalidSequence, mockContext);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(
          result.error.message.includes(
            "Complete command requires GenerateTemplate",
          ),
          true,
        );
      }
    });

    it("should handle empty sequence", () => {
      const result = validateCommandSequence([], mockContext);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(result.error.message.includes("ParseFrontmatter"), true);
      }
    });
  });

  describe("Command sequence integration", () => {
    it("should create and validate all supported modes", () => {
      const modes: Array<"standard" | "validation-only" | "template-only"> = [
        "standard",
        "validation-only",
        "template-only",
      ];

      for (const mode of modes) {
        const sequenceResult = createCommandSequence(
          mockContext,
          testInputContent,
          mode,
        );
        assertEquals(
          sequenceResult.ok,
          true,
          `Failed to create ${mode} sequence`,
        );

        if (sequenceResult.ok) {
          const validationResult = validateCommandSequence(
            sequenceResult.data,
            mockContext,
          );
          assertEquals(
            validationResult.ok,
            true,
            `Failed to validate ${mode} sequence`,
          );
        }
      }
    });

    it("should maintain command ordering consistency", () => {
      const standardResult = createCommandSequence(
        mockContext,
        testInputContent,
        "standard",
      );
      assertEquals(standardResult.ok, true);

      if (standardResult.ok) {
        const sequence = standardResult.data;

        // ParseFrontmatter should always be first
        assertEquals(sequence[0].kind, "ParseFrontmatter");

        // LoadSchema should come before ValidateData
        const loadSchemaIndex = sequence.findIndex((cmd) =>
          cmd.kind === "LoadSchema"
        );
        const validateDataIndex = sequence.findIndex((cmd) =>
          cmd.kind === "ValidateData"
        );

        if (loadSchemaIndex !== -1 && validateDataIndex !== -1) {
          assertEquals(loadSchemaIndex < validateDataIndex, true);
        }

        // GenerateTemplate should come before Complete
        const generateTemplateIndex = sequence.findIndex((cmd) =>
          cmd.kind === "GenerateTemplate"
        );
        const completeIndex = sequence.findIndex((cmd) =>
          cmd.kind === "Complete"
        );

        if (generateTemplateIndex !== -1 && completeIndex !== -1) {
          assertEquals(generateTemplateIndex < completeIndex, true);
        }
      }
    });
  });
});
