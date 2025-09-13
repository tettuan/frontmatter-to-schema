import {
  OutputSpecification,
  OutputFormat,
  Result,
  success,
  failure
} from '../template-shared/value-objects.ts';
import { CompiledTemplate } from '../template-building/compiled-template.ts';

/**
 * Rendered output ready for writing
 */
export class RenderedOutput {
  constructor(
    private readonly content: Buffer | string,
    private readonly format: OutputFormat,
    private readonly source: CompiledTemplate,
    private readonly metadata: OutputMetadata
  ) {}

  getContent(): Buffer | string {
    return this.content;
  }

  getFormat(): OutputFormat {
    return this.format;
  }

  getSource(): CompiledTemplate {
    return this.source;
  }

  getMetadata(): OutputMetadata {
    return this.metadata;
  }

  getChecksum(): string {
    const content = typeof this.content === 'string'
      ? this.content
      : this.content.toString('base64');

    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Output metadata
 */
export interface OutputMetadata {
  renderedAt: Date;
  size: number;
  encoding: string;
  templatePath: string;
}

/**
 * Domain service responsible for rendering compiled templates
 */
export class OutputRenderer {
  /**
   * Renders a compiled template according to specification
   */
  async render(
    template: CompiledTemplate,
    specification: OutputSpecification
  ): Promise<Result<RenderedOutput, RenderError>> {
    try {
      // Get compiled content
      const compiledContent = template.getCompiledContent();

      // Convert format if needed
      const convertedContent = await this.convertFormat(
        compiledContent,
        template.getFormat(),
        specification.format
      );

      // Apply encoding
      const encodedContent = this.applyEncoding(
        convertedContent,
        specification.encoding
      );

      // Apply any additional options
      const finalContent = this.applyOptions(
        encodedContent,
        specification.options
      );

      // Calculate size
      const size = typeof finalContent === 'string'
        ? Buffer.byteLength(finalContent)
        : finalContent.length;

      // Create metadata
      const metadata: OutputMetadata = {
        renderedAt: new Date(),
        size,
        encoding: specification.encoding,
        templatePath: template.getTemplatePath().toString()
      };

      // Create rendered output
      const renderedOutput = new RenderedOutput(
        finalContent,
        specification.format,
        template,
        metadata
      );

      return success(renderedOutput);
    } catch (error) {
      return failure(new RenderError(
        `Rendering failed: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Converts content between formats if needed
   */
  private async convertFormat(
    content: string | Buffer,
    sourceFormat: OutputFormat,
    targetFormat: OutputFormat
  ): Promise<string> {
    // If same format, no conversion needed
    if (sourceFormat === targetFormat) {
      return typeof content === 'string' ? content : content.toString('utf-8');
    }

    const contentStr = typeof content === 'string' ? content : content.toString('utf-8');

    // Handle format conversions
    if (sourceFormat === OutputFormat.JSON && targetFormat === OutputFormat.YAML) {
      return this.jsonToYaml(contentStr);
    }

    if (sourceFormat === OutputFormat.YAML && targetFormat === OutputFormat.JSON) {
      return this.yamlToJson(contentStr);
    }

    if (targetFormat === OutputFormat.TEXT) {
      // Any format can be converted to text
      return this.toPlainText(contentStr, sourceFormat);
    }

    // For unsupported conversions, return as-is
    return contentStr;
  }

  /**
   * Converts JSON to YAML format
   */
  private jsonToYaml(jsonContent: string): string {
    try {
      const data = JSON.parse(jsonContent);
      return this.objectToYaml(data, 0);
    } catch {
      return jsonContent;
    }
  }

  /**
   * Converts object to YAML string
   */
  private objectToYaml(obj: any, indent: number): string {
    const spaces = '  '.repeat(indent);
    let result = '';

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          result += `${spaces}- \n${this.objectToYaml(item, indent + 1)}`;
        } else {
          result += `${spaces}- ${item}\n`;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          result += `${spaces}${key}:\n${this.objectToYaml(value, indent + 1)}`;
        } else {
          result += `${spaces}${key}: ${value}\n`;
        }
      }
    } else {
      result = `${spaces}${obj}\n`;
    }

    return result;
  }

  /**
   * Converts YAML to JSON format
   */
  private yamlToJson(yamlContent: string): string {
    // Simple YAML to JSON conversion (production would use a proper parser)
    try {
      // This is a simplified version - real implementation would use a YAML parser
      const lines = yamlContent.split('\n');
      const result: any = {};
      let currentObj = result;
      const stack: any[] = [result];

      for (const line of lines) {
        if (line.trim() === '') continue;

        const indent = line.search(/\S/);
        const trimmed = line.trim();

        if (trimmed.startsWith('- ')) {
          // Array item
          const value = trimmed.substring(2).trim();
          if (!Array.isArray(currentObj)) {
            currentObj = [];
            stack[stack.length - 1] = currentObj;
          }
          currentObj.push(value);
        } else if (trimmed.includes(': ')) {
          // Key-value pair
          const [key, ...valueParts] = trimmed.split(': ');
          const value = valueParts.join(': ').trim();

          if (value === '') {
            currentObj[key] = {};
            stack.push(currentObj[key]);
            currentObj = currentObj[key];
          } else {
            currentObj[key] = value;
          }
        }
      }

      return JSON.stringify(result, null, 2);
    } catch {
      return yamlContent;
    }
  }

  /**
   * Converts to plain text format
   */
  private toPlainText(content: string, sourceFormat: OutputFormat): string {
    switch (sourceFormat) {
      case OutputFormat.JSON:
        try {
          const data = JSON.parse(content);
          return this.objectToText(data);
        } catch {
          return content;
        }

      case OutputFormat.HTML:
      case OutputFormat.XML:
        // Strip tags
        return content.replace(/<[^>]*>/g, '');

      case OutputFormat.MARKDOWN:
        // Remove markdown syntax (simplified)
        return content
          .replace(/^#+\s/gm, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      default:
        return content;
    }
  }

  /**
   * Converts object to text representation
   */
  private objectToText(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let result = '';

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          result += this.objectToText(item, indent);
        } else {
          result += `${spaces}${item}\n`;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          result += `${spaces}${key}:\n${this.objectToText(value, indent + 1)}`;
        } else {
          result += `${spaces}${key}: ${value}\n`;
        }
      }
    } else {
      result = `${spaces}${obj}\n`;
    }

    return result;
  }

  /**
   * Applies encoding to content
   */
  private applyEncoding(content: string, encoding: string): string | Buffer {
    if (encoding === 'base64') {
      return Buffer.from(content).toString('base64');
    }

    // For other encodings, return as string (Buffer handling would be in infrastructure)
    return content;
  }

  /**
   * Applies additional options to content
   */
  private applyOptions(
    content: string | Buffer,
    options?: Record<string, unknown>
  ): string | Buffer {
    if (!options) {
      return content;
    }

    let result = typeof content === 'string' ? content : content.toString('utf-8');

    // Apply formatting options
    if (options.indent) {
      const indent = String(options.indent);
      result = result.split('\n').map(line => indent + line).join('\n');
    }

    if (options.lineEnding) {
      const ending = String(options.lineEnding);
      result = result.replace(/\r?\n/g, ending);
    }

    if (options.trim) {
      result = result.trim();
    }

    return typeof content === 'string' ? result : Buffer.from(result);
  }
}

/**
 * Render error
 */
export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}