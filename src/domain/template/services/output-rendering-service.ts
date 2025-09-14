import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { TemplateRenderer } from "../renderers/template-renderer.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

export type RenderingMode =
  | {
      readonly kind: "SingleData";
      readonly data: FrontmatterData;
    }
  | {
      readonly kind: "ArrayData";
      readonly dataArray: FrontmatterData[];
    };

export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

export interface FileWriter {
  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }>;
}

/**
 * Domain service responsible for Output rendering stage of the 3-stage pipeline.
 * Handles: Template + Data → RenderedOutput + File writing
 */
export class OutputRenderingService {
  constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
  ) {}

  /**
   * Render data using template and write to output file.
   * Follows Totality principle - all error paths handled explicitly.
   * Uses discriminated union to eliminate partial states.
   */
  renderOutput(
    templatePath: string,
    renderingMode: RenderingMode,
    outputPath: string,
  ): Result<void, DomainError & { message: string }> {
    // Stage 1: Load and create template
    const templateResult = this.loadTemplate(templatePath);
    if (!templateResult.ok) {
      return templateResult;
    }

    // Stage 2: Render data with template using exhaustive pattern matching
    const renderResult = renderingMode.kind === "ArrayData"
      ? this.templateRenderer.renderWithArray(
          templateResult.data,
          renderingMode.dataArray,
        )
      : this.templateRenderer.render(
          templateResult.data,
          renderingMode.data,
        );

    if (!renderResult.ok) {
      return renderResult;
    }

    // Stage 3: Write rendered output to file
    return this.fileWriter.write(outputPath, renderResult.data);
  }

  /**
   * Load template from file path and create Template entity.
   * All error cases handled with Result types.
   */
  private loadTemplate(
    templatePath: string,
  ): Result<Template, DomainError & { message: string }> {
    // Create template path value object
    const templatePathResult = TemplatePath.create(templatePath);
    if (!templatePathResult.ok) {
      return templatePathResult;
    }

    // Read template file content
    const templateContentResult = this.fileReader.read(templatePath);
    if (!templateContentResult.ok) {
      return templateContentResult;
    }

    // Parse template JSON
    const parseResult = this.safeJsonParse(templateContentResult.data);
    if (!parseResult.ok) {
      return err(createError({
        kind: "InvalidTemplate",
        template: templatePath,
        message: `Failed to parse template JSON: ${parseResult.error.message}`,
      }));
    }

    const templateContent = parseResult.data;

    // Create Template entity
    return Template.create(templatePathResult.data, templateContent);
  }

  private safeJsonParse(content: string): Result<unknown, { message: string }> {
    try {
      return ok(JSON.parse(content));
    } catch (error) {
      return err({
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
