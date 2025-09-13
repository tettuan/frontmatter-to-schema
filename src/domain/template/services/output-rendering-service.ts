import { err, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { TemplateRenderer } from "../renderers/template-renderer.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

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
   */
  renderOutput(
    templatePath: string,
    data: FrontmatterData,
    outputPath: string,
    dataArray?: FrontmatterData[],
  ): Result<void, DomainError & { message: string }> {
    // Stage 1: Load and create template
    const templateResult = this.loadTemplate(templatePath);
    if (!templateResult.ok) {
      return templateResult;
    }

    // Stage 2: Render data with template
    const renderResult = dataArray && dataArray.length > 1
      ? this.templateRenderer.renderWithArray(templateResult.data, dataArray)
      : this.templateRenderer.render(templateResult.data, data);

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
    let templateContent: unknown;
    try {
      templateContent = JSON.parse(templateContentResult.data);
    } catch (error) {
      return err(createError({
        kind: "InvalidTemplate",
        template: templatePath,
        message: `Failed to parse template JSON: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }

    // Create Template entity
    return Template.create(templatePathResult.data, templateContent);
  }
}
