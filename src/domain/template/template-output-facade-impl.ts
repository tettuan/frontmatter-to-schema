/**
 * Template Output Facade Implementation
 * Handles template rendering and output following DDD principles
 */

import type { Result } from "../core/result.ts";
import type {
  OutputError,
  OutputSpecification,
  RenderedTemplate,
  RenderError,
  TemplateOutputFacade,
} from "./template-output-facade.ts";
import type { CompiledTemplate } from "./template-builder-facade.ts";

/**
 * Concrete implementation of RenderedTemplate
 */
class RenderedTemplateImpl implements RenderedTemplate {
  constructor(
    public readonly content: string,
    public readonly specification: OutputSpecification,
    public readonly renderedAt: Date,
    public readonly size: number,
  ) {}
}

/**
 * Template Output Facade Implementation
 * Ensures all output goes through proper domain boundaries
 * No direct file writes allowed
 */
export class TemplateOutputFacadeImpl implements TemplateOutputFacade {
  async renderTemplate(
    template: CompiledTemplate,
    specification: OutputSpecification,
  ): Promise<Result<RenderedTemplate, RenderError>> {
    try {
      // Validate template first
      const validationResult = await Promise.resolve(template.validate());
      if (!validationResult.ok) {
        return {
          ok: false,
          error: {
            kind: "RenderError",
            message:
              `Template validation failed: ${validationResult.error.message}`,
            template: template.templatePath.toString(),
            details: validationResult.error,
          },
        };
      }

      // Apply formatting based on specification
      let formattedContent = template.compiledContent;

      if (specification.prettify) {
        if (template.format === "json") {
          try {
            const parsed = JSON.parse(template.compiledContent);
            formattedContent = JSON.stringify(parsed, null, 2);
          } catch {
            // Keep original if parsing fails
          }
        }
        // Add other format prettifiers as needed
      }

      // Create rendered template
      const rendered = new RenderedTemplateImpl(
        formattedContent,
        specification,
        new Date(),
        new TextEncoder().encode(formattedContent).length,
      );

      return { ok: true, data: rendered };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "RenderError",
          message: `Failed to render template: ${error}`,
          template: template.templatePath.toString(),
          details: error,
        },
      };
    }
  }

  async writeTemplate(
    rendered: RenderedTemplate,
  ): Promise<Result<void, OutputError>> {
    try {
      // Write to destination
      await Deno.writeTextFile(
        rendered.specification.destination,
        rendered.content,
      );

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "OutputError",
          message: `Failed to write template: ${error}`,
          destination: rendered.specification.destination,
          details: error,
        },
      };
    }
  }

  async outputTemplate(
    template: CompiledTemplate,
    specification: OutputSpecification,
  ): Promise<Result<void, RenderError | OutputError>> {
    // Render template
    const renderResult = await this.renderTemplate(template, specification);
    if (!renderResult.ok) {
      return renderResult;
    }

    // Write rendered template
    const writeResult = await this.writeTemplate(renderResult.data);
    if (!writeResult.ok) {
      return writeResult;
    }

    return { ok: true, data: undefined };
  }
}
