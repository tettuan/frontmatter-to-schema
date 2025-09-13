/**
 * Template Output Facade - Domain interface for template output
 * Following DDD and Totality principles from docs/architecture/template-domain-architecture.ja.md
 */

import type { Result } from "../core/result.ts";
import type { CompiledTemplate } from "./template-builder-facade.ts";

/**
 * Output specification for template rendering
 */
export interface OutputSpecification {
  destination: string;
  format?: "json" | "yaml" | "text";
  encoding?: "utf-8" | "utf-16";
  prettify?: boolean;
}

/**
 * Rendered template ready for output
 */
export interface RenderedTemplate {
  content: string;
  specification: OutputSpecification;
  renderedAt: Date;
  size: number;
}

export interface RenderError {
  kind: "RenderError";
  message: string;
  template?: string;
  details?: unknown;
}

export interface OutputError {
  kind: "OutputError";
  message: string;
  destination?: string;
  details?: unknown;
}

/**
 * Template Output Facade Interface
 * Single entry point for template output domain
 * All output operations must go through this facade
 * Direct file/API writes are prohibited
 */
export interface TemplateOutputFacade {
  /**
   * Render a compiled template with specification
   * @param template Compiled template to render
   * @param specification Output specification
   * @returns Rendered template or error
   */
  renderTemplate(
    template: CompiledTemplate,
    specification: OutputSpecification,
  ): Promise<Result<RenderedTemplate, RenderError>>;

  /**
   * Write rendered template to destination
   * @param rendered Rendered template to write
   * @returns Success or output error
   */
  writeTemplate(
    rendered: RenderedTemplate,
  ): Promise<Result<void, OutputError>>;

  /**
   * Combined render and write operation
   * @param template Compiled template
   * @param specification Output specification
   * @returns Success or error
   */
  outputTemplate(
    template: CompiledTemplate,
    specification: OutputSpecification,
  ): Promise<Result<void, RenderError | OutputError>>;
}