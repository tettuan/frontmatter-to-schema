// FrontMatter extractor implementation

import { extract } from "jsr:@std/front-matter@1.0.5/yaml";
import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import { type Document, FrontMatter } from "../../domain/models/entities.ts";
import { FrontMatterContent } from "../../domain/models/value-objects.ts";
import type {
  FrontMatterExtractionResult,
  FrontMatterExtractor,
} from "../../domain/services/interfaces.ts";

export class FrontMatterExtractorImpl implements FrontMatterExtractor {
  extract(
    document: Document,
  ): Result<FrontMatterExtractionResult, DomainError & { message: string }> {
    // Use totality-compliant getFrontMatter()
    const frontMatterResult = document.getFrontMatter();
    if (frontMatterResult.ok) {
      const frontMatter = frontMatterResult.data;
      return { ok: true, data: { kind: "Extracted", frontMatter } };
    }

    try {
      const content = document.getContent().getValue();

      // Check if content has frontmatter markers before attempting extraction
      if (!content.startsWith("---\n")) {
        return { ok: true, data: { kind: "NotPresent" } };
      }

      const extracted = extract(content);

      // Use attrs (parsed YAML) instead of frontMatter (raw string)
      const parsedFrontMatter = extracted.attrs;

      if (
        !parsedFrontMatter ||
        typeof parsedFrontMatter !== "object" ||
        Object.keys(parsedFrontMatter).length === 0
      ) {
        return { ok: true, data: { kind: "NotPresent" } };
      }

      // Add document path to frontmatter data
      const enhancedFrontMatter = {
        ...parsedFrontMatter,
        _documentPath: document.getPath().getValue(),
      };

      // Use fromObject instead of create with JSON string
      // enhancedFrontMatter is guaranteed to be Record<string, unknown> from object spread
      const frontMatterContentResult = FrontMatterContent.fromObject(
        enhancedFrontMatter,
      );

      if (!frontMatterContentResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ExtractionStrategyFailed",
            strategy: "frontmatter",
            input: document.getPath().getValue(),
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

      return { ok: true, data: { kind: "Extracted", frontMatter } };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: "frontmatter",
          input: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
