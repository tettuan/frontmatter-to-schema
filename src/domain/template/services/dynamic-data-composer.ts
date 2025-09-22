import { chain, err, map, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ArrayExpansionKey } from "../value-objects/template-structure.ts";
import { ComposedData } from "../value-objects/variable-context.ts";
import { ARRAY_EXPANSION_PLACEHOLDER } from "../constants/template-variable-constants.ts";

/**
 * Composes data dynamically based on template structure analysis
 * Replaces hardcoded 'items' key logic with schema-driven composition
 * Following DDD domain service pattern with Totality principles
 */
export class DynamicDataComposer {
  private constructor() {}

  /**
   * Smart Constructor following Totality pattern
   */
  static create(): Result<
    DynamicDataComposer,
    TemplateError & { message: string }
  > {
    return ok(new DynamicDataComposer());
  }

  /**
   * Compose data dynamically based on template array expansion keys
   * Replaces the hardcoded 'items' key approach
   */
  compose(
    mainData: FrontmatterData,
    itemsData: FrontmatterData[],
    expansionKeys: ArrayExpansionKey[],
  ): Result<ComposedData, TemplateError & { message: string }> {
    return chain(
      this.extractMainData(mainData),
      (main) =>
        chain(
          this.extractItemsData(itemsData),
          (items) => this.composeWithExpansionKeys(main, items, expansionKeys),
        ),
    );
  }

  /**
   * Compose data for single-data scenario (no items)
   */
  composeSingle(
    mainData: FrontmatterData,
  ): Result<ComposedData, TemplateError & { message: string }> {
    return map(
      this.extractMainData(mainData),
      (main) => ({
        mainData: main,
        arrayData: undefined,
      }),
    );
  }

  /**
   * Compose data for array-only scenario
   */
  composeArray(
    itemsData: FrontmatterData[],
  ): Result<ComposedData, TemplateError & { message: string }> {
    return map(
      this.extractItemsData(itemsData),
      (items) => ({
        mainData: {},
        arrayData: items,
      }),
    );
  }

  /**
   * Extract main data safely
   */
  private extractMainData(
    mainData: FrontmatterData,
  ): Result<Record<string, unknown>, TemplateError & { message: string }> {
    try {
      const data = mainData.getData();
      return ok(data);
    } catch (error) {
      return err(createError({
        kind: "DataCompositionFailed",
        reason: `Failed to extract main data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }

  /**
   * Extract items data safely
   */
  private extractItemsData(
    itemsData: FrontmatterData[],
  ): Result<unknown[], TemplateError & { message: string }> {
    try {
      const items = itemsData.map((item) => item.getData());
      return ok(items);
    } catch (error) {
      return err(createError({
        kind: "DataCompositionFailed",
        reason: `Failed to extract items data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }

  /**
   * Compose data using dynamic keys from template analysis
   * This replaces the hardcoded 'items' key logic
   */
  private composeWithExpansionKeys(
    mainData: Record<string, unknown>,
    itemsData: unknown[],
    expansionKeys: ArrayExpansionKey[],
  ): Result<ComposedData, TemplateError & { message: string }> {
    const composedMain = { ...mainData };

    // For each expansion key, prepare the data structure
    for (const key of expansionKeys) {
      if (key.expansionMarker === ARRAY_EXPANSION_PLACEHOLDER) {
        // Use the dynamic key name from template analysis instead of hardcoded 'items'
        const dynamicKey = this.determineDynamicKey(key, mainData);

        // Store items data in a way that can be accessed during rendering
        // Instead of hardcoding 'items', use the analyzed template structure
        composedMain[dynamicKey] = itemsData;
      }
    }

    return ok({
      mainData: composedMain,
      arrayData: itemsData,
    });
  }

  /**
   * Determine the appropriate key name for array expansion
   * Based on template structure rather than hardcoded 'items'
   */
  private determineDynamicKey(
    expansionKey: ArrayExpansionKey,
    mainData: Record<string, unknown>,
  ): string {
    // Use the template key as the dynamic key
    // This respects the template structure rather than hardcoding
    const templateKey = expansionKey.templateKey;

    // If the template key conflicts with existing data, generate a unique key
    if (Object.prototype.hasOwnProperty.call(mainData, templateKey)) {
      return `${templateKey}_items`;
    }

    return templateKey;
  }

  /**
   * Create composed data for dual-template rendering
   * Used when both main template and items template are present
   */
  createDualTemplateData(
    mainData: FrontmatterData,
    renderedItems: string[],
  ): Result<ComposedData, TemplateError & { message: string }> {
    return map(
      this.extractMainData(mainData),
      (main) => {
        // Handle both JSON and non-JSON rendered items
        let itemsValue: string;
        try {
          // Try to parse as JSON objects and re-stringify as an array
          const parsedItems = renderedItems.map((item) => {
            try {
              return JSON.parse(item);
            } catch {
              // If item is not JSON, treat as string content
              return item;
            }
          });
          itemsValue = JSON.stringify(parsedItems);
        } catch (_error) {
          // Fallback: join as simple string array
          itemsValue = JSON.stringify(renderedItems);
        }

        // Parse items as array for proper {@items} expansion
        const parsedItemsArray = renderedItems.map((item) => {
          try {
            return JSON.parse(item);
          } catch {
            return item;
          }
        });

        return {
          mainData: {
            ...main,
            // Store under both items (for {{items}}) and @items (for array expansion)
            items: itemsValue,
            "@items": parsedItemsArray,
          },
          arrayData: parsedItemsArray,
        };
      },
    );
  }
}
