import {
  Result,
  success,
  failure,
  OutputFormat
} from '../template-shared/value-objects.ts';
import { RenderedOutput } from './output-renderer.ts';

/**
 * Domain service for validating output before delivery
 */
export class OutputValidator {
  /**
   * Validates rendered output
   */
  validate(output: RenderedOutput): Result<void, OutputValidationError> {
    // Check content exists
    const content = output.getContent();
    if (!content) {
      return failure(new OutputValidationError('Output content is empty'));
    }

    // Check content size
    const size = typeof content === 'string'
      ? Buffer.byteLength(content)
      : content.length;

    if (size === 0) {
      return failure(new OutputValidationError('Output content has zero size'));
    }

    // Validate format-specific requirements
    const formatValidation = this.validateFormat(output);
    if (!formatValidation.ok) {
      return formatValidation;
    }

    // Validate metadata
    const metadataValidation = this.validateMetadata(output);
    if (!metadataValidation.ok) {
      return metadataValidation;
    }

    // Check for common issues
    const issuesValidation = this.checkCommonIssues(output);
    if (!issuesValidation.ok) {
      return issuesValidation;
    }

    return success(undefined);
  }

  /**
   * Validates format-specific requirements
   */
  private validateFormat(output: RenderedOutput): Result<void, OutputValidationError> {
    const content = output.getContent();
    const contentStr = typeof content === 'string'
      ? content
      : content.toString('utf-8');

    const format = output.getFormat();

    switch (format) {
      case OutputFormat.JSON:
        return this.validateJson(contentStr);

      case OutputFormat.YAML:
        return this.validateYaml(contentStr);

      case OutputFormat.XML:
        return this.validateXml(contentStr);

      case OutputFormat.HTML:
        return this.validateHtml(contentStr);

      case OutputFormat.MARKDOWN:
        return this.validateMarkdown(contentStr);

      default:
        // Text format - no specific validation
        return success(undefined);
    }
  }

  /**
   * Validates JSON format
   */
  private validateJson(content: string): Result<void, OutputValidationError> {
    try {
      const parsed = JSON.parse(content);

      // Check for empty objects or arrays
      if (typeof parsed === 'object') {
        if (Array.isArray(parsed) && parsed.length === 0) {
          return failure(new OutputValidationError('JSON output is an empty array'));
        }
        if (!Array.isArray(parsed) && Object.keys(parsed).length === 0) {
          return failure(new OutputValidationError('JSON output is an empty object'));
        }
      }

      return success(undefined);
    } catch (error) {
      return failure(new OutputValidationError(
        `Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Validates YAML format
   */
  private validateYaml(content: string): Result<void, OutputValidationError> {
    // Basic YAML validation
    if (content.includes('\t')) {
      return failure(new OutputValidationError('YAML cannot contain tab characters'));
    }

    // Check for common YAML issues
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for mixed indentation
      if (line.startsWith(' ') && line.includes('\t')) {
        return failure(new OutputValidationError(
          `Mixed indentation at line ${i + 1}`
        ));
      }

      // Check for trailing whitespace (can cause issues)
      if (line.trimEnd() !== line) {
        return failure(new OutputValidationError(
          `Trailing whitespace at line ${i + 1}`
        ));
      }
    }

    return success(undefined);
  }

  /**
   * Validates XML format
   */
  private validateXml(content: string): Result<void, OutputValidationError> {
    // Basic XML validation
    if (!content.includes('<') || !content.includes('>')) {
      return failure(new OutputValidationError('Invalid XML format: missing tags'));
    }

    // Check for XML declaration
    if (!content.trim().startsWith('<?xml') && !content.trim().startsWith('<')) {
      return failure(new OutputValidationError('Invalid XML format: invalid start'));
    }

    // Simple tag balance check
    const openTags = (content.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
    const selfClosing = (content.match(/<[^>]*\/>/g) || []).length;

    if (openTags !== closeTags + selfClosing) {
      return failure(new OutputValidationError(
        'XML tags are not properly balanced'
      ));
    }

    return success(undefined);
  }

  /**
   * Validates HTML format
   */
  private validateHtml(content: string): Result<void, OutputValidationError> {
    // Basic HTML validation
    if (!content.includes('<') || !content.includes('>')) {
      return failure(new OutputValidationError('Invalid HTML format: missing tags'));
    }

    // Check for common HTML structure elements
    const hasHtmlTag = /<html[\s>]/i.test(content);
    const hasBodyTag = /<body[\s>]/i.test(content);
    const hasHeadTag = /<head[\s>]/i.test(content);

    // If it looks like a full HTML document, validate structure
    if (hasHtmlTag) {
      if (!hasBodyTag) {
        return failure(new OutputValidationError(
          'HTML document missing <body> tag'
        ));
      }
    }

    return success(undefined);
  }

  /**
   * Validates Markdown format
   */
  private validateMarkdown(content: string): Result<void, OutputValidationError> {
    // Basic markdown validation - check for common patterns
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for unclosed code blocks
      if (line.startsWith('```')) {
        let closed = false;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('```')) {
            closed = true;
            i = j; // Skip to the closing block
            break;
          }
        }
        if (!closed) {
          return failure(new OutputValidationError(
            `Unclosed code block starting at line ${i + 1}`
          ));
        }
      }
    }

    return success(undefined);
  }

  /**
   * Validates output metadata
   */
  private validateMetadata(output: RenderedOutput): Result<void, OutputValidationError> {
    const metadata = output.getMetadata();

    if (!metadata) {
      return failure(new OutputValidationError('Output metadata is missing'));
    }

    if (!metadata.renderedAt) {
      return failure(new OutputValidationError('Output missing rendered timestamp'));
    }

    if (typeof metadata.size !== 'number' || metadata.size < 0) {
      return failure(new OutputValidationError('Invalid output size in metadata'));
    }

    if (!metadata.encoding) {
      return failure(new OutputValidationError('Output missing encoding information'));
    }

    if (!metadata.templatePath) {
      return failure(new OutputValidationError('Output missing template path'));
    }

    return success(undefined);
  }

  /**
   * Checks for common issues in output
   */
  private checkCommonIssues(output: RenderedOutput): Result<void, OutputValidationError> {
    const content = output.getContent();
    const contentStr = typeof content === 'string'
      ? content
      : content.toString('utf-8');

    // Check for null bytes (can cause issues)
    if (contentStr.includes('\0')) {
      return failure(new OutputValidationError(
        'Output contains null bytes which may cause issues'
      ));
    }

    // Check for BOM in UTF-8 (can cause issues)
    if (contentStr.charCodeAt(0) === 0xFEFF) {
      return failure(new OutputValidationError(
        'Output contains UTF-8 BOM which may cause issues'
      ));
    }

    // Check for control characters (except common ones like \n, \r, \t)
    const controlChars = contentStr.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g);
    if (controlChars && controlChars.length > 0) {
      return failure(new OutputValidationError(
        'Output contains control characters which may cause issues'
      ));
    }

    return success(undefined);
  }
}

/**
 * Output validation error
 */
export class OutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputValidationError';
  }
}