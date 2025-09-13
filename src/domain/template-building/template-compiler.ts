import {
  TemplateSource,
  TemplateFilePath,
  TemplateValueSet,
  OutputFormat,
  Result,
  success,
  failure
} from '../template-shared/value-objects.ts';
import { CompiledTemplate } from './compiled-template.ts';

/**
 * Domain service responsible for compiling templates with values
 */
export class TemplateCompiler {
  constructor(
    private readonly templateLoader: TemplateLoader
  ) {}

  /**
   * Compiles a template with the provided values
   */
  async compile(source: TemplateSource): Promise<Result<CompiledTemplate, CompilationError>> {
    try {
      // Load template content
      const templateResult = await this.templateLoader.load(source.templatePath);
      if (!templateResult.ok) {
        return failure(new CompilationError(
          `Failed to load template: ${templateResult.error.message}`
        ));
      }

      const templateContent = templateResult.data;

      // Apply values to template
      const compiledContent = this.applyValues(templateContent, source.valueSet);

      // Detect output format from template or default
      const format = this.detectFormat(source.templatePath, templateContent);

      // Create compiled template
      const compiledTemplate = new CompiledTemplate({
        templatePath: source.templatePath,
        appliedValues: source.valueSet,
        compiledContent,
        format
      });

      // Validate the compiled template
      const validationResult = compiledTemplate.validate();
      if (!validationResult.ok) {
        return failure(new CompilationError(
          `Template validation failed: ${validationResult.error.message}`
        ));
      }

      return success(compiledTemplate);
    } catch (error) {
      return failure(new CompilationError(
        `Compilation failed: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Applies values to template content
   */
  private applyValues(templateContent: string, valueSet: TemplateValueSet): string {
    let result = templateContent;

    // Simple template variable replacement (can be enhanced with template engines)
    for (const [key, value] of Object.entries(valueSet.values)) {
      // Handle different placeholder formats
      const patterns = [
        new RegExp(`{{\\s*${key}\\s*}}`, 'g'),      // {{ key }}
        new RegExp(`\\$\\{${key}\\}`, 'g'),         // ${key}
        new RegExp(`<%=\\s*${key}\\s*%>`, 'g'),     // <%= key %>
      ];

      for (const pattern of patterns) {
        result = result.replace(pattern, this.formatValue(value));
      }
    }

    return result;
  }

  /**
   * Formats a value for template insertion
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  /**
   * Detects output format from template path or content
   */
  private detectFormat(templatePath: TemplateFilePath, content: string): OutputFormat {
    const pathStr = templatePath.toString().toLowerCase();

    // Check file extension
    if (pathStr.endsWith('.json') || pathStr.endsWith('.json.tmpl')) {
      return OutputFormat.JSON;
    }
    if (pathStr.endsWith('.yaml') || pathStr.endsWith('.yml') ||
        pathStr.endsWith('.yaml.tmpl') || pathStr.endsWith('.yml.tmpl')) {
      return OutputFormat.YAML;
    }
    if (pathStr.endsWith('.xml') || pathStr.endsWith('.xml.tmpl')) {
      return OutputFormat.XML;
    }
    if (pathStr.endsWith('.md') || pathStr.endsWith('.markdown') ||
        pathStr.endsWith('.md.tmpl') || pathStr.endsWith('.markdown.tmpl')) {
      return OutputFormat.MARKDOWN;
    }
    if (pathStr.endsWith('.html') || pathStr.endsWith('.htm') ||
        pathStr.endsWith('.html.tmpl') || pathStr.endsWith('.htm.tmpl')) {
      return OutputFormat.HTML;
    }

    // Try to detect from content
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return OutputFormat.JSON;
    }
    if (trimmed.startsWith('<')) {
      return OutputFormat.XML;
    }
    if (trimmed.includes('---\n') || trimmed.includes(': ')) {
      return OutputFormat.YAML;
    }

    // Default
    return OutputFormat.TEXT;
  }
}

/**
 * Interface for template loading
 */
export interface TemplateLoader {
  load(templatePath: TemplateFilePath): Promise<Result<string, Error>>;
}

/**
 * Compilation error
 */
export class CompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompilationError';
  }
}