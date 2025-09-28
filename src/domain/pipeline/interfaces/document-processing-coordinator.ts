import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

/**
 * Processing options using discriminated unions (Totality principle)
 */
export type ProcessingOptions =
  | {
    readonly kind: "sequential";
  }
  | {
    readonly kind: "parallel";
    readonly maxWorkers: number;
  };

/**
 * Domain interface for document processing coordination
 * Following DDD principles - Domain defines its own contracts
 * Following Totality principles - all operations return Result<T,E>
 */
export interface DocumentProcessingCoordinator {
  /**
   * Coordinate processing of documents from input pattern
   */
  processDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options?: ProcessingOptions,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>>;

  /**
   * Process documents with items extraction
   */
  processDocumentsWithItemsExtraction(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options?: ProcessingOptions,
  ): Promise<
    Result<{
      mainData: FrontmatterData;
      itemsData?: FrontmatterData[];
    }, DomainError & { message: string }>
  >;
}
