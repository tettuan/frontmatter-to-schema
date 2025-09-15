import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { VerbosityMode } from "./processing-context.ts";

/**
 * Template configuration discriminated union following Totality principles.
 * Replaces optional template path parameters with explicit business states.
 */
export type TemplateConfiguration =
  | {
    readonly kind: "SingleTemplate";
    readonly path: string;
  }
  | {
    readonly kind: "DualTemplate";
    readonly mainPath: string;
    readonly itemsPath: string;
  };

/**
 * Data configuration discriminated union following Totality principles.
 * Replaces optional data parameters with explicit business states.
 */
export type DataConfiguration =
  | {
    readonly kind: "SingleData";
    readonly data: FrontmatterData;
  }
  | {
    readonly kind: "ArrayData";
    readonly mainData: FrontmatterData;
    readonly itemsData: FrontmatterData[];
  };

/**
 * Complete rendering configuration that combines template and data configurations.
 * This replaces multiple optional parameters with a single, type-safe configuration.
 */
export interface RenderingConfiguration {
  readonly templateConfig: TemplateConfiguration;
  readonly dataConfig: DataConfiguration;
  readonly outputPath: string;
  readonly outputFormat: "json" | "yaml" | "markdown";
  readonly verbosityMode: VerbosityMode;
}

/**
 * Template path resolution result following Totality principles.
 * Replaces nullable path returns with explicit success/failure states.
 */
export type TemplatePathResolution =
  | {
    readonly kind: "TemplateFound";
    readonly path: string;
  }
  | {
    readonly kind: "TemplateNotFound";
    readonly reason: string;
  };

/**
 * Hierarchy root result following Totality principles.
 * Replaces nullable hierarchy root returns with explicit states.
 */
export type HierarchyRootResult =
  | {
    readonly kind: "HasHierarchyRoot";
    readonly root: string;
  }
  | {
    readonly kind: "NoHierarchyRoot";
  };

/**
 * Helper functions for creating template configurations
 */
export const TemplateConfigurationHelpers = {
  /**
   * Create a single template configuration
   */
  single(path: string): TemplateConfiguration {
    return {
      kind: "SingleTemplate",
      path,
    };
  },

  /**
   * Create a dual template configuration
   */
  dual(mainPath: string, itemsPath: string): TemplateConfiguration {
    return {
      kind: "DualTemplate",
      mainPath,
      itemsPath,
    };
  },
} as const;

/**
 * Helper functions for creating data configurations
 */
export const DataConfigurationHelpers = {
  /**
   * Create a single data configuration
   */
  single(data: FrontmatterData): DataConfiguration {
    return {
      kind: "SingleData",
      data,
    };
  },

  /**
   * Create an array data configuration
   */
  array(
    mainData: FrontmatterData,
    itemsData: FrontmatterData[],
  ): DataConfiguration {
    return {
      kind: "ArrayData",
      mainData,
      itemsData,
    };
  },
} as const;
