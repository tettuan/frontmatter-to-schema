/**
 * Adapter to wrap the simple FrontMatterExtractor from frontmatter-models.ts
 * This follows the adapter pattern to bridge domain boundaries
 */

import { FrontMatterExtractor as SimpleFrontMatterExtractor } from "../../domain/frontmatter/frontmatter-models.ts";
import type {
  FrontMatterExtractionResult,
  FrontMatterExtractor,
} from "../../domain/services/interfaces.ts";
import type { Document } from "../../domain/models/entities.ts";
import { FrontMatter as FrontMatterEntity } from "../../domain/models/entities.ts";
import { FrontMatterContent } from "../../domain/models/value-objects.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";

/**
 * Adapter that bridges the simple FrontMatterExtractor to the domain interface
 * This maintains domain boundary separation following DDD principles
 */
export class SimpleFrontMatterAdapter implements FrontMatterExtractor {
  private readonly extractor: SimpleFrontMatterExtractor;

  constructor() {
    this.extractor = new SimpleFrontMatterExtractor();
  }

  extract(
    document: Document,
  ): Result<FrontMatterExtractionResult, DomainError & { message: string }> {
    try {
      const content = document.getContent().getValue();
      const extracted = this.extractor.extract(content);

      if (!extracted) {
        return { ok: true, data: { kind: "NotPresent" } };
      }

      // Convert the simple FrontMatter to domain FrontMatter
      const frontMatterContentResult = FrontMatterContent.fromObject(
        extracted.data,
      );

      if (!frontMatterContentResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            frontMatterContentResult.error,
            "Failed to create FrontMatterContent",
          ),
        };
      }

      const frontMatter = FrontMatterEntity.create(
        frontMatterContentResult.data,
        extracted.raw,
      );

      return { ok: true, data: { kind: "Extracted", frontMatter } };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: "simple-frontmatter",
          input: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
