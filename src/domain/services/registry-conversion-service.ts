/**
 * Registry Conversion Service
 *
 * Handles type-safe frontmatter conversion following Totality principle.
 * Extracted from BuildRegistryUseCase to reduce AI complexity.
 * Maintains existing logic with enhanced error handling.
 */

import type { DomainError, Result } from "../core/result.ts";
import { FrontMatter } from "../models/entities.ts";
import { FrontMatterContent } from "../models/value-objects.ts";

/**
 * Service responsible for type-safe frontmatter conversion
 * Following Totality principle to eliminate unsafe type casting
 */
export class RegistryConversionService {
  /**
   * Type-safe conversion from frontmatter-models.FrontMatter to entities.FrontMatter
   * Extracted from BuildRegistryUseCase.convertFrontMatterSafely() lines 268-309
   * Following Totality principle to eliminate unsafe type casting
   */
  convertFrontMatterSafely(
    sourceFrontMatter:
      import("../frontmatter/frontmatter-models.ts").FrontMatter,
  ): Result<FrontMatter, DomainError> {
    try {
      // Create FrontMatterContent from the source data using smart constructor
      const contentResult = FrontMatterContent.fromObject(
        sourceFrontMatter.data,
      );
      if (!contentResult.ok) {
        return {
          ok: false,
          error: {
            kind: "InvalidState",
            expected: "valid FrontMatterContent",
            actual: "conversion failed",
          } as DomainError,
        };
      }

      // Create the target FrontMatter instance
      const targetFrontMatter = new FrontMatter(
        contentResult.data,
        sourceFrontMatter.raw,
      );

      return { ok: true, data: targetFrontMatter };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateMappingFailed",
          template: "FrontMatter conversion",
          source: sourceFrontMatter.data,
        } as DomainError,
      };
    }
  }

  /**
   * Validate frontmatter content for CLI registry requirements
   * Additional validation logic for registry-specific needs
   */
  validateRegistryFrontMatter(
    frontMatter: FrontMatter,
  ): Result<void, DomainError> {
    const data = frontMatter.getContent().toJSON();

    // Basic validation for required registry fields
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        error: {
          kind: "InvalidState",
          expected: "object frontmatter data",
          actual: typeof data,
        } as DomainError,
      };
    }

    // Registry-specific validation can be added here
    // Following Totality principle - all cases handled
    return { ok: true, data: undefined };
  }
}
