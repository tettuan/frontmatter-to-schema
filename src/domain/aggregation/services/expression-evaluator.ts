import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

export class ExpressionEvaluator {
  evaluate(
    data: FrontmatterData[],
    expression: string,
  ): Result<unknown[], AggregationError & { message: string }> {
    if (!expression.includes("[]")) {
      return err(createError({
        kind: "InvalidExpression",
        expression,
      }, "Expression must contain array notation []"));
    }

    const parts = expression.split("[]");
    if (parts.length !== 2) {
      return err(createError({
        kind: "InvalidExpression",
        expression,
      }, "Expression must have exactly one array notation []"));
    }

    const basePath = parts[0];
    const propertyPath = parts[1].startsWith(".") ? parts[1].substring(1) : "";

    const results: unknown[] = [];

    for (const item of data) {
      const baseValue = basePath ? item.get(basePath) : item.getData();

      if (!Array.isArray(baseValue)) {
        continue;
      }

      for (const arrayItem of baseValue) {
        if (propertyPath) {
          const itemData = FrontmatterData.create(arrayItem);
          if (itemData.ok) {
            const value = itemData.data.get(propertyPath);
            if (value !== undefined) {
              results.push(value);
            }
          }
        } else {
          results.push(arrayItem);
        }
      }
    }

    return ok(results);
  }

  evaluateUnique(
    data: FrontmatterData[],
    expression: string,
  ): Result<unknown[], AggregationError & { message: string }> {
    const evaluationResult = this.evaluate(data, expression);
    if (!evaluationResult.ok) {
      return evaluationResult;
    }

    const unique = Array.from(
      new Set(
        evaluationResult.data.map((item) =>
          typeof item === "object" ? JSON.stringify(item) : item
        ),
      ),
    ).map((item) => {
      try {
        return JSON.parse(item as string);
      } catch {
        return item;
      }
    });

    return ok(unique);
  }

  evaluatePath(
    data: unknown,
    path: string,
  ): Result<unknown, AggregationError & { message: string }> {
    const parts = path.split(".");
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return err(createError({
          kind: "PathNotFound",
          path,
        }));
      }

      if (part === "[]" && Array.isArray(current)) {
        continue;
      }

      if (typeof current !== "object" || Array.isArray(current)) {
        return err(createError({
          kind: "PathNotFound",
          path,
        }));
      }

      current = (current as Record<string, unknown>)[part];
    }

    return ok(current);
  }
}
