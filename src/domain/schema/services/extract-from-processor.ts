/**
 * @fileoverview ExtractFromProcessor - Minimal stub to resolve CI errors
 * TODO: Replace with full implementation when x-extract-from feature is developed
 */

import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { PropertyExtractor } from "../extractors/property-extractor.ts";
import { ExtractFromDirective } from "../value-objects/extract-from-directive.ts";

/**
 * Minimal stub implementation of ExtractFromProcessor
 * Exists solely to satisfy TypeScript compilation during development phase
 */
export class ExtractFromProcessor {
  private constructor(_propertyExtractor?: PropertyExtractor) {}

  static create(
    propertyExtractor?: PropertyExtractor,
  ): Result<ExtractFromProcessor, DomainError & { message: string }> {
    return ok(new ExtractFromProcessor(propertyExtractor));
  }

  processDirectives(
    data: FrontmatterData,
    _directives: ExtractFromDirective[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    return ok(data);
  }
}
