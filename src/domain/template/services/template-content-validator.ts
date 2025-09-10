/**
 * Template Content Validator - Domain Service
 * Validates template content according to business rules
 * Part of Template Context - Domain Layer
 * Follows Totality principles with Smart Constructor pattern
 */

import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

/**
 * Smart Constructor for Template Content (Totality Pattern)
 */
export class ValidatedTemplateContent {
  private constructor(readonly content: string) {}

  static create(
    content: unknown,
  ): ValidatedTemplateContent | DomainError {
    if (typeof content !== "string") {
      return createDomainError({
        kind: "InvalidFormat",
        input: typeof content,
        expectedFormat: "string",
      }, `Template content must be string, got ${typeof content}`);
    }

    if (content.trim() === "") {
      return createDomainError({
        kind: "EmptyInput",
      }, "Template content cannot be empty");
    }

    return new ValidatedTemplateContent(content);
  }
}
