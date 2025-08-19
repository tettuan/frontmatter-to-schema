// FrontMatter extractor implementation

import { extract } from "jsr:@std/front-matter@1.0.5/any";
import {
  createError,
  type ProcessingError,
  type Result,
} from "../../domain/shared/types.ts";
import { type Document, FrontMatter } from "../../domain/models/entities.ts";
import { FrontMatterContent } from "../../domain/models/value-objects.ts";
import type { FrontMatterExtractor } from "../../domain/services/interfaces.ts";

export class FrontMatterExtractorImpl implements FrontMatterExtractor {
  extract(
    document: Document,
  ): Result<FrontMatter | null, ProcessingError & { message: string }> {
    // If document already has frontmatter, return it
    if (document.hasFrontMatter()) {
      return { ok: true, data: document.getFrontMatter() };
    }

    try {
      const content = document.getContent().getValue();
      const extracted = extract(content);

      if (
        !extracted.frontMatter ||
        Object.keys(extracted.frontMatter).length === 0
      ) {
        return { ok: true, data: null };
      }

      // Convert frontmatter to JSON string
      const frontMatterStr = JSON.stringify(extracted.frontMatter);
      const frontMatterContentResult = FrontMatterContent.create(
        frontMatterStr,
      );

      if (!frontMatterContentResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ExtractionFailed",
            document: document.getPath().getValue(),
            reason: "Invalid frontmatter content",
          }),
        };
      }

      // Extract raw frontmatter text
      const rawMatch = content.match(/^---\n([\s\S]*?)\n---/);
      const rawFrontMatter = rawMatch ? rawMatch[1] : "";

      const frontMatter = FrontMatter.create(
        frontMatterContentResult.data,
        rawFrontMatter,
      );

      return { ok: true, data: frontMatter };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "ExtractionFailed",
          document: document.getPath().getValue(),
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
