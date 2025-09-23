/**
 * @fileoverview Tests for Issue #905 Error Handler Enhancements
 * @description Tests for enhanced error handling with user-friendly messages and recovery suggestions
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  ErrorHandler,
  ErrorHandlerConfig,
} from "../../../../src/application/services/error-handler.ts";
import {
  ExtractionErrorContextFactory,
  ExtractionErrorFactory,
} from "../../../../src/domain/errors/extraction-errors.ts";

describe("ErrorHandler Issue #905 Enhancements", () => {
  describe("Configuration and Debug Mode", () => {
    it("should create ErrorHandler with default configuration", () => {
      const handler = ErrorHandler.create();

      assert(handler instanceof ErrorHandler);
      const debugConfig = handler.getDebugConfig();
      assertEquals(debugConfig.enabled, false);
      assertEquals(debugConfig.level, "basic");
    });

    it("should create ErrorHandler with custom configuration", () => {
      const config: Partial<ErrorHandlerConfig> = {
        debugMode: true,
        verboseLogging: true,
        enableRecovery: true,
        continueOnError: true,
      };

      const handler = ErrorHandler.create(config);
      const debugConfig = handler.getDebugConfig();

      assertEquals(debugConfig.enabled, true);
      assertEquals(debugConfig.level, "verbose");
      assertEquals(debugConfig.verboseLogging, true);
    });

    it("should allow runtime debug mode configuration", () => {
      const handler = ErrorHandler.create();

      // Initially disabled
      assertEquals(handler.getDebugConfig().enabled, false);

      // Enable with verbose level
      handler.setDebugMode(true, "verbose");
      assertEquals(handler.getDebugConfig().enabled, true);
      assertEquals(handler.getDebugConfig().level, "verbose");

      // Disable
      handler.setDebugMode(false);
      assertEquals(handler.getDebugConfig().enabled, false);
    });
  });

  describe("Schema Directive Validation", () => {
    it("should validate schema directives successfully", async () => {
      const handler = ErrorHandler.create({
        debugMode: true,
      });

      const mockSchema = {
        type: "object",
        properties: {
          field: {
            type: "string",
            "x-frontmatter-part": "valid.path",
          },
        },
      };

      const result = await handler.validateSchemaDirectives(mockSchema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isValid, true);
        assertEquals(result.data.errors.length, 0);
        assert(result.data.debugInfo !== undefined);
      }
    });
  });

  describe("Error Handling with Recovery Suggestions", () => {
    it("should handle PropertyNotFound error with recovery suggestions", () => {
      const handler = ErrorHandler.create({
        debugMode: true,
      });

      const error = ExtractionErrorFactory.createPropertyNotFound(
        "missing.path",
        ["available.path", "another.path"],
        "test source",
      );

      const context = ExtractionErrorContextFactory.create(
        "extract-from",
        "extraction",
        { test: "data" },
        { schema: "info" },
      );

      const errorWithRecovery = handler.handleExtractionError(error, context);

      assertEquals(errorWithRecovery.error.kind, "PropertyNotFound");
      assert(errorWithRecovery.recoverySuggestions.length > 0);
      assert(errorWithRecovery.debugInfo !== undefined);

      const firstSuggestion = errorWithRecovery.recoverySuggestions[0];
      assert(firstSuggestion.description.includes("path exists"));
    });

    it("should handle TypeMismatchInExtraction error", () => {
      const handler = ErrorHandler.create();

      const error = ExtractionErrorFactory.createTypeMismatchInExtraction(
        "number",
        "string",
        "test.field",
        "not-a-number",
      );

      const context = ExtractionErrorContextFactory.create(
        "type-conversion",
        "extraction",
      );

      const errorWithRecovery = handler.handleExtractionError(error, context);

      assertEquals(errorWithRecovery.error.kind, "TypeMismatchInExtraction");
      assert(errorWithRecovery.recoverySuggestions.length > 0);

      const firstSuggestion = errorWithRecovery.recoverySuggestions[0];
      assert(firstSuggestion.description.includes("Convert source"));
    });
  });

  describe("User-Friendly Error Messages", () => {
    it("should create comprehensive error message with suggestions", () => {
      const handler = ErrorHandler.create({
        debugMode: true,
        verboseLogging: true,
      });

      const error = ExtractionErrorFactory.createPropertyNotFound(
        "missing.path",
        ["correct.path", "another.option"],
        "test source",
      );

      const context = ExtractionErrorContextFactory.create(
        "extract-from",
        "extraction",
        { test: "data" },
      );

      const errorWithRecovery = handler.handleExtractionError(error, context);
      const message = handler.createUserFriendlyErrorMessage(errorWithRecovery);

      assert(message.includes('Property "missing.path" not found'));
      assert(message.includes("💡 Suggestions:"));
      assert(message.includes("1. Verify the path exists"));
      assert(message.includes("2. Use one of these similar paths"));
      assert(message.includes("🔍 Debug Information:"));
      assert(message.includes("Performance:"));
    });

    it("should exclude debug information when disabled", () => {
      const handler = ErrorHandler.create({
        debugMode: false,
      });

      const error = ExtractionErrorFactory.createPropertyNotFound(
        "missing.path",
        ["correct.path"],
        "test source",
      );

      const context = ExtractionErrorContextFactory.create(
        "extract-from",
        "extraction",
      );

      const errorWithRecovery = handler.handleExtractionError(error, context);
      const message = handler.createUserFriendlyErrorMessage(errorWithRecovery);

      assert(message.includes('Property "missing.path" not found'));
      assert(message.includes("💡 Suggestions:"));
      assert(!message.includes("🔍 Debug Information:"));
    });
  });
});
