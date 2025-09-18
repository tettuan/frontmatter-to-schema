import { chain, err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import {
  ArrayExpansionKey,
  TemplateStructure,
  VariableReference,
} from "../value-objects/template-structure.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

/**
 * Analyzes template structure to identify dynamic keys and variable patterns
 * Following DDD domain service pattern with Totality principles
 */
export class TemplateStructureAnalyzer {
  private constructor() {}

  /**
   * Smart Constructor following Totality pattern
   */
  static create(): Result<
    TemplateStructureAnalyzer,
    TemplateError & { message: string }
  > {
    return ok(new TemplateStructureAnalyzer());
  }

  /**
   * Analyze template structure to identify patterns
   */
  analyzeStructure(
    template: Template,
  ): Result<TemplateStructure, TemplateError & { message: string }> {
    const content = template.getContent();

    return chain(
      this.analyzeContent(content),
      (analysis: AnalysisResult) =>
        TemplateStructure.create(
          analysis.arrayKeys,
          analysis.variables,
          analysis.staticContent,
        ),
    );
  }

  /**
   * Analyze template content for patterns
   */
  private analyzeContent(
    content: unknown,
  ): Result<AnalysisResult, TemplateError & { message: string }> {
    if (typeof content === "string") {
      return this.analyzeStringContent(content);
    }

    if (Array.isArray(content)) {
      return this.analyzeArrayContent(content);
    }

    if (content && typeof content === "object") {
      const objResult = SafePropertyAccess.asRecord(content);
      if (!objResult.ok) {
        return err(createError({
          kind: "InvalidTemplate",
          message: "Content is not a valid object for structure analysis",
        }));
      }
      return this.analyzeObjectContent(objResult.data);
    }

    // Handle primitive content
    return ok({
      arrayKeys: [],
      variables: [],
      staticContent: [String(content)],
    });
  }

  /**
   * Analyze string template content
   */
  private analyzeStringContent(
    content: string,
  ): Result<AnalysisResult, TemplateError & { message: string }> {
    const arrayKeys: ArrayExpansionKey[] = [];
    const variables: VariableReference[] = [];
    const staticParts: string[] = [];

    // Find array expansion patterns {@items}
    const arrayPattern = /\{@(\w+)\}/g;
    let arrayMatch;
    while ((arrayMatch = arrayPattern.exec(content)) !== null) {
      const marker = arrayMatch[0];
      const keyName = arrayMatch[1];

      const keyResult = ArrayExpansionKey.create(
        "items", // Default key name for string templates
        marker,
        keyName,
      );
      if (!keyResult.ok) {
        return keyResult;
      }
      arrayKeys.push(keyResult.data);
    }

    // Find variable patterns {variable.path}
    const variablePattern = /\{([^@}][^}]*)\}/g;
    let variableMatch;
    while ((variableMatch = variablePattern.exec(content)) !== null) {
      const placeholder = variableMatch[0];
      const variablePath = variableMatch[1];
      const position = variableMatch.index;

      const varResult = VariableReference.create(
        placeholder,
        variablePath,
        position,
      );
      if (!varResult.ok) {
        return varResult;
      }
      variables.push(varResult.data);
    }

    staticParts.push(content);

    return ok({
      arrayKeys,
      variables,
      staticContent: staticParts,
    });
  }

  /**
   * Analyze array template content
   */
  private analyzeArrayContent(
    content: unknown[],
  ): Result<AnalysisResult, TemplateError & { message: string }> {
    const arrayKeys: ArrayExpansionKey[] = [];
    const variables: VariableReference[] = [];
    const staticParts: string[] = [];

    for (let i = 0; i < content.length; i++) {
      const item = content[i];

      if (typeof item === "string" && item === "{@items}") {
        const keyResult = ArrayExpansionKey.create(
          `array_${i}`,
          "{@items}",
          "items",
        );
        if (!keyResult.ok) {
          return keyResult;
        }
        arrayKeys.push(keyResult.data);
      } else {
        const itemAnalysis = this.analyzeContent(item);
        if (!itemAnalysis.ok) {
          return itemAnalysis;
        }
        arrayKeys.push(...itemAnalysis.data.arrayKeys);
        variables.push(...itemAnalysis.data.variables);
        staticParts.push(...itemAnalysis.data.staticContent);
      }
    }

    return ok({
      arrayKeys,
      variables,
      staticContent: staticParts,
    });
  }

  /**
   * Analyze object template content
   */
  private analyzeObjectContent(
    content: Record<string, unknown>,
  ): Result<AnalysisResult, TemplateError & { message: string }> {
    const arrayKeys: ArrayExpansionKey[] = [];
    const variables: VariableReference[] = [];
    const staticParts: string[] = [];

    for (const [key, value] of Object.entries(content)) {
      // Check if this property contains array expansion
      if (typeof value === "string" && value.includes("{@items}")) {
        const keyResult = ArrayExpansionKey.create(
          key,
          "{@items}",
          "items",
        );
        if (!keyResult.ok) {
          return keyResult;
        }
        arrayKeys.push(keyResult.data);
      }

      // Analyze value for variables and nested structures
      const valueAnalysis = this.analyzeContent(value);
      if (!valueAnalysis.ok) {
        return valueAnalysis;
      }

      arrayKeys.push(...valueAnalysis.data.arrayKeys);
      variables.push(...valueAnalysis.data.variables);
      staticParts.push(...valueAnalysis.data.staticContent);
    }

    return ok({
      arrayKeys,
      variables,
      staticContent: staticParts,
    });
  }
}

/**
 * Result of template structure analysis
 */
interface AnalysisResult {
  readonly arrayKeys: ArrayExpansionKey[];
  readonly variables: VariableReference[];
  readonly staticContent: string[];
}
