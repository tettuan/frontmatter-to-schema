import { err, ok, Result } from "../../../shared/types/result.ts";
import { createError, TemplateError } from "../../../shared/types/errors.ts";
import { JsonFormatter } from "./json-formatter.ts";

/**
 * MarkdownFormatter handles formatting data as Markdown with JSON code blocks.
 * Follows Totality principles with Result<T,E> pattern.
 */
export class MarkdownFormatter {
  private constructor(private readonly jsonFormatter: JsonFormatter) {}

  /**
   * Smart Constructor for MarkdownFormatter
   * @returns Result containing MarkdownFormatter instance or error
   */
  static create(): Result<
    MarkdownFormatter,
    TemplateError & { message: string }
  > {
    const jsonFormatterResult = JsonFormatter.create();
    if (!jsonFormatterResult.ok) {
      return jsonFormatterResult;
    }

    return ok(new MarkdownFormatter(jsonFormatterResult.data));
  }

  /**
   * Formats data as Markdown with JSON code block
   * @param data - Data to format
   * @returns Result containing formatted Markdown string or error
   */
  format(data: unknown): Result<string, TemplateError & { message: string }> {
    const jsonResult = this.jsonFormatter.format(data);
    if (!jsonResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message: `Markdown formatting failed: ${jsonResult.error.message}`,
      }));
    }

    const markdownContent = `# Generated Output

\`\`\`json
${jsonResult.data}
\`\`\`
`;

    return ok(markdownContent);
  }
}
