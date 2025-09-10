/**
 * Template Management Domain
 *
 * Public API for the template bounded context
 */

// Main template processor
export { UnifiedTemplateProcessor } from "./unified-template-processor.ts";

// Format handlers - removed in DDD refactoring
// export {
//   type TemplateFormatHandler,
//   TemplateFormatHandlerFactory,
// } from "./format-handlers.ts";

// Repository exports
export type { TemplateRepository } from "../services/interfaces.ts";
export { TemplatePath } from "../models/value-objects.ts";
