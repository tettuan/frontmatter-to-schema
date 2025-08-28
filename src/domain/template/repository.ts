/**
 * Template Repository Re-exports
 *
 * This file provides backward compatibility by re-exporting
 * the consolidated interfaces from the main domain services.
 *
 * The actual implementations are now centralized in:
 * - TemplatePath: ../models/value-objects.ts
 * - TemplateRepository: ../services/interfaces.ts
 */

// Re-export consolidated interfaces
export type { TemplateRepository } from "../services/interfaces.ts";
export { TemplatePath } from "../models/value-objects.ts";
