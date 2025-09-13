import {
  TemplateFilePath,
  TemplateValueSet,
  OutputFormat,
  Result,
  success,
  failure
} from '../template-shared/value-objects.ts';

/**
 * Represents a compiled template ready for output
 */
export class CompiledTemplate {
  private readonly templatePath: TemplateFilePath;
  private readonly appliedValues: TemplateValueSet;
  private readonly compiledContent: string | Buffer;
  private readonly compiledAt: Date;
  private readonly checksum: string;
  private readonly format: OutputFormat;

  constructor(params: {
    templatePath: TemplateFilePath;
    appliedValues: TemplateValueSet;
    compiledContent: string | Buffer;
    format: OutputFormat;
  }) {
    this.templatePath = params.templatePath;
    this.appliedValues = params.appliedValues;
    this.compiledContent = params.compiledContent;
    this.format = params.format;
    this.compiledAt = new Date();
    this.checksum = this.calculateChecksum();
  }

  private calculateChecksum(): string {
    const content = typeof this.compiledContent === 'string'
      ? this.compiledContent
      : this.compiledContent.toString('base64');

    // Simple checksum for demonstration - in production use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  getTemplatePath(): TemplateFilePath {
    return this.templatePath;
  }

  getAppliedValues(): TemplateValueSet {
    return this.appliedValues;
  }

  getCompiledContent(): string | Buffer {
    return this.compiledContent;
  }

  getFormat(): OutputFormat {
    return this.format;
  }

  getCompiledAt(): Date {
    return this.compiledAt;
  }

  getChecksum(): string {
    return this.checksum;
  }

  /**
   * Validates the compiled template
   */
  validate(): Result<void, ValidationError> {
    // Check if content is not empty
    if (!this.compiledContent ||
        (typeof this.compiledContent === 'string' && this.compiledContent.trim() === '') ||
        (Buffer.isBuffer(this.compiledContent) && this.compiledContent.length === 0)) {
      return failure(new ValidationError('Compiled content cannot be empty'));
    }

    // Check if values were applied
    if (!this.appliedValues.values || Object.keys(this.appliedValues.values).length === 0) {
      return failure(new ValidationError('No values were applied to template'));
    }

    // Validate format-specific requirements
    const formatValidation = this.validateFormat();
    if (!formatValidation.ok) {
      return formatValidation;
    }

    return success(undefined);
  }

  private validateFormat(): Result<void, ValidationError> {
    const content = typeof this.compiledContent === 'string'
      ? this.compiledContent
      : this.compiledContent.toString('utf-8');

    switch (this.format) {
      case OutputFormat.JSON:
        try {
          JSON.parse(content);
          return success(undefined);
        } catch (e) {
          return failure(new ValidationError(`Invalid JSON format: ${e}`));
        }

      case OutputFormat.YAML:
        // Basic YAML validation - check for common syntax
        if (content.includes('\t')) {
          return failure(new ValidationError('YAML cannot contain tabs'));
        }
        return success(undefined);

      case OutputFormat.XML:
        // Basic XML validation
        if (!content.includes('<') || !content.includes('>')) {
          return failure(new ValidationError('Invalid XML format'));
        }
        return success(undefined);

      default:
        return success(undefined);
    }
  }

  /**
   * Creates a copy with updated content
   */
  withUpdatedContent(newContent: string | Buffer): CompiledTemplate {
    return new CompiledTemplate({
      templatePath: this.templatePath,
      appliedValues: this.appliedValues,
      compiledContent: newContent,
      format: this.format
    });
  }
}

/**
 * Validation error for compiled templates
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}