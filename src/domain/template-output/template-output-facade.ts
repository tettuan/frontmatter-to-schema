import {
  OutputSpecification,
  OutputDestination,
  Result,
  success,
  failure
} from '../template-shared/value-objects.ts';
import { CompiledTemplate } from '../template-building/compiled-template.ts';
import { OutputRenderer, RenderedOutput, RenderError } from './output-renderer.ts';
import { OutputWriter, OutputWriteAdapter, WriteResult, WriteError } from './output-writer.ts';
import { OutputValidator, OutputValidationError } from './output-validator.ts';

/**
 * Facade for Template Output Domain
 * This is the ONLY entry point for external interaction with the Template Output Domain
 */
export class TemplateOutputFacade {
  private readonly renderer: OutputRenderer;
  private readonly writer: OutputWriter;
  private readonly validator: OutputValidator;

  constructor(writeAdapter: OutputWriteAdapter) {
    this.renderer = new OutputRenderer();
    this.writer = new OutputWriter(writeAdapter);
    this.validator = new OutputValidator();
  }

  /**
   * Renders a compiled template according to specification
   */
  async renderTemplate(
    template: CompiledTemplate,
    specification: OutputSpecification
  ): Promise<Result<RenderedOutput, RenderError>> {
    try {
      // Validate template before rendering
      const templateValidation = template.validate();
      if (!templateValidation.ok) {
        return failure(new RenderError(
          `Template validation failed: ${templateValidation.error.message}`
        ));
      }

      // Render the template
      const renderResult = await this.renderer.render(template, specification);
      if (!renderResult.ok) {
        return renderResult;
      }

      const renderedOutput = renderResult.data;

      // Validate rendered output
      const outputValidation = this.validator.validate(renderedOutput);
      if (!outputValidation.ok) {
        return failure(new RenderError(
          `Rendered output validation failed: ${outputValidation.error.message}`
        ));
      }

      return success(renderedOutput);
    } catch (error) {
      return failure(new RenderError(
        `Unexpected error during rendering: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Outputs a rendered template to its destination
   */
  async outputTemplate(
    rendered: RenderedOutput,
    destination: OutputDestination
  ): Promise<Result<void, OutputError>> {
    try {
      // Validate output before writing
      const validation = this.validator.validate(rendered);
      if (!validation.ok) {
        return failure(new OutputError(
          `Output validation failed: ${validation.error.message}`,
          'VALIDATION_ERROR'
        ));
      }

      // Write the output
      const writeResult = await this.writer.write(rendered, destination);
      if (!writeResult.ok) {
        return failure(new OutputError(
          `Write operation failed: ${writeResult.error.message}`,
          'WRITE_ERROR'
        ));
      }

      return success(undefined);
    } catch (error) {
      return failure(new OutputError(
        `Unexpected error during output: ${error instanceof Error ? error.message : String(error)}`,
        'UNEXPECTED_ERROR'
      ));
    }
  }

  /**
   * Performs atomic output with rollback on failure
   */
  async outputTemplateAtomic(
    rendered: RenderedOutput,
    destination: OutputDestination
  ): Promise<Result<void, OutputError>> {
    try {
      // Validate output before writing
      const validation = this.validator.validate(rendered);
      if (!validation.ok) {
        return failure(new OutputError(
          `Output validation failed: ${validation.error.message}`,
          'VALIDATION_ERROR'
        ));
      }

      // Perform atomic write
      const writeResult = await this.writer.writeAtomic(rendered, destination);
      if (!writeResult.ok) {
        return failure(new OutputError(
          `Atomic write operation failed: ${writeResult.error.message}`,
          'ATOMIC_WRITE_ERROR'
        ));
      }

      return success(undefined);
    } catch (error) {
      return failure(new OutputError(
        `Unexpected error during atomic output: ${error instanceof Error ? error.message : String(error)}`,
        'UNEXPECTED_ERROR'
      ));
    }
  }

  /**
   * Validates a rendered output
   */
  validateOutput(output: RenderedOutput): Result<void, OutputValidationError> {
    return this.validator.validate(output);
  }

  /**
   * Convenience method: Renders and outputs a template in one operation
   */
  async processTemplate(
    template: CompiledTemplate,
    specification: OutputSpecification
  ): Promise<Result<void, OutputError>> {
    // Render the template
    const renderResult = await this.renderTemplate(template, specification);
    if (!renderResult.ok) {
      return failure(new OutputError(
        `Rendering failed: ${renderResult.error.message}`,
        'RENDER_ERROR'
      ));
    }

    // Output the rendered template
    return this.outputTemplate(renderResult.data, specification.destination);
  }

  /**
   * Batch processes multiple templates
   */
  async processTemplates(
    templates: Array<{
      template: CompiledTemplate;
      specification: OutputSpecification;
    }>
  ): Promise<Result<void, OutputError>> {
    const errors: string[] = [];

    for (const { template, specification } of templates) {
      const result = await this.processTemplate(template, specification);
      if (!result.ok) {
        errors.push(`${specification.destination.getTarget()}: ${result.error.message}`);
      }
    }

    if (errors.length > 0) {
      return failure(new OutputError(
        `Batch processing failed:\n${errors.join('\n')}`,
        'BATCH_ERROR'
      ));
    }

    return success(undefined);
  }
}

/**
 * Output error for template output operations
 */
export class OutputError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'OutputError';
  }
}