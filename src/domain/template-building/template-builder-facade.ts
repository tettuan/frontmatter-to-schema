import {
  TemplateSource,
  Result,
  success,
  failure
} from '../template-shared/value-objects.ts';
import { CompiledTemplate, ValidationError } from './compiled-template.ts';
import { TemplateCompiler, TemplateLoader, CompilationError } from './template-compiler.ts';
import { TemplateValidator, TemplateSchema } from './template-validator.ts';

/**
 * Facade for Template Building Domain
 * This is the ONLY entry point for external interaction with the Template Building Domain
 */
export class TemplateBuilderFacade {
  private readonly compiler: TemplateCompiler;
  private readonly validator: TemplateValidator;

  constructor(templateLoader: TemplateLoader) {
    this.compiler = new TemplateCompiler(templateLoader);
    this.validator = new TemplateValidator();
  }

  /**
   * Builds a template from source data
   * This is the primary method for template compilation
   */
  async buildTemplate(
    source: TemplateSource,
    schema?: TemplateSchema
  ): Promise<Result<CompiledTemplate, BuildError>> {
    try {
      // Validate input values if schema provided
      if (schema) {
        const validationResult = this.validator.validate(source.valueSet, schema);
        if (!validationResult.ok) {
          return failure(new BuildError(
            `Value validation failed: ${validationResult.error.message}`,
            'VALIDATION_ERROR'
          ));
        }
      }

      // Compile template with values
      const compilationResult = await this.compiler.compile(source);
      if (!compilationResult.ok) {
        return failure(new BuildError(
          `Template compilation failed: ${compilationResult.error.message}`,
          'COMPILATION_ERROR'
        ));
      }

      const compiledTemplate = compilationResult.data;

      // Validate compiled template
      const templateValidation = compiledTemplate.validate();
      if (!templateValidation.ok) {
        return failure(new BuildError(
          `Compiled template validation failed: ${templateValidation.error.message}`,
          'TEMPLATE_VALIDATION_ERROR'
        ));
      }

      return success(compiledTemplate);
    } catch (error) {
      return failure(new BuildError(
        `Unexpected error during template building: ${error instanceof Error ? error.message : String(error)}`,
        'UNEXPECTED_ERROR'
      ));
    }
  }

  /**
   * Composes multiple templates into a single template
   */
  async composeTemplates(
    templates: CompiledTemplate[]
  ): Promise<Result<CompiledTemplate, CompositionError>> {
    try {
      if (templates.length === 0) {
        return failure(new CompositionError('No templates provided for composition'));
      }

      if (templates.length === 1) {
        return success(templates[0]);
      }

      // Merge template contents
      const mergedContent = this.mergeTemplateContents(templates);

      // Use the first template's metadata as base
      const baseTemplate = templates[0];

      // Create composed template
      const composedTemplate = baseTemplate.withUpdatedContent(mergedContent);

      // Validate composed template
      const validation = composedTemplate.validate();
      if (!validation.ok) {
        return failure(new CompositionError(
          `Composed template validation failed: ${validation.error.message}`
        ));
      }

      return success(composedTemplate);
    } catch (error) {
      return failure(new CompositionError(
        `Template composition failed: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Validates a compiled template
   */
  validateTemplate(template: CompiledTemplate): Result<void, ValidationError> {
    return template.validate();
  }

  /**
   * Merges multiple template contents
   */
  private mergeTemplateContents(templates: CompiledTemplate[]): string {
    const contents: string[] = [];

    for (const template of templates) {
      const content = template.getCompiledContent();
      const contentStr = typeof content === 'string'
        ? content
        : content.toString('utf-8');
      contents.push(contentStr);
    }

    // Merge based on format of first template
    const format = templates[0].getFormat();

    switch (format) {
      case 'json':
        return this.mergeJsonContents(contents);
      case 'yaml':
        return this.mergeYamlContents(contents);
      case 'xml':
        return this.mergeXmlContents(contents);
      default:
        // For text/markdown/html, concatenate with newlines
        return contents.join('\n\n');
    }
  }

  /**
   * Merges JSON contents
   */
  private mergeJsonContents(contents: string[]): string {
    try {
      const objects = contents.map(c => JSON.parse(c));

      if (objects.every(o => Array.isArray(o))) {
        // If all are arrays, concatenate them
        const merged = objects.flat();
        return JSON.stringify(merged, null, 2);
      } else if (objects.every(o => typeof o === 'object' && !Array.isArray(o))) {
        // If all are objects, merge them
        const merged = Object.assign({}, ...objects);
        return JSON.stringify(merged, null, 2);
      } else {
        // Mixed types, wrap in array
        return JSON.stringify(objects, null, 2);
      }
    } catch {
      // If parsing fails, concatenate as text
      return contents.join('\n');
    }
  }

  /**
   * Merges YAML contents
   */
  private mergeYamlContents(contents: string[]): string {
    // Simple concatenation with document separator
    return contents.join('\n---\n');
  }

  /**
   * Merges XML contents
   */
  private mergeXmlContents(contents: string[]): string {
    // Wrap in root element
    const innerContent = contents
      .map(c => c.replace(/<\?xml[^>]*\?>/g, ''))
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<merged>\n${innerContent}\n</merged>`;
  }
}

/**
 * Build error for template building operations
 */
export class BuildError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'BuildError';
  }
}

/**
 * Composition error for template composition operations
 */
export class CompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompositionError';
  }
}