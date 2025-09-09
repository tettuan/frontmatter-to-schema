// Path utilities for template processing

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import type { PathResolutionResult } from "../../frontmatter/entities/frontmatter.ts";
import type { Template } from "../entities/template-core.ts";
import { PropertyPath } from "../../../domain/models/property-path.ts";

export class TemplatePathUtils {
  /**
   * Get value from data object by path (supports nested paths like "options.input")
   */
  static getValueByPath(
    data: Record<string, unknown>,
    path: string,
  ): PathResolutionResult {
    const keys = path.split(".");
    let current: unknown = data;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return { kind: "NotFound", path };
      }
    }

    return { kind: "Found", value: current };
  }

  /**
   * Set value by path using PropertyPathNavigator for totality compliance
   */
  static setValueByPath(
    template: Template,
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    const propertyPathResult = PropertyPath.create(path);
    if (!propertyPathResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: path,
          expectedFormat: "valid.property.path",
        }, `Invalid property path: ${propertyPathResult.error.message}`),
      };
    }

    const assignmentResult = template.getPathNavigator().assign(
      obj,
      propertyPathResult.data,
      value,
    );

    if (!assignmentResult.ok) {
      return assignmentResult;
    }

    switch (assignmentResult.data.kind) {
      case "Success":
      case "PathCreated":
        return { ok: true, data: undefined };
      case "TypeConflict":
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: assignmentResult.data.existingType,
              expectedFormat: "object",
            },
            `Type conflict at path '${assignmentResult.data.conflictSegment}': expected object, got ${assignmentResult.data.existingType}`,
          ),
        };
      default: {
        const _exhaustiveCheck: never = assignmentResult.data;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "Success, PathCreated, or TypeConflict",
            actual: String(_exhaustiveCheck),
          }, `Unhandled assignment result: ${String(_exhaustiveCheck)}`),
        };
      }
    }
  }
}
