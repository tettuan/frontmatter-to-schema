/**
 * UnifiedTemplateProcessor - Legacy Compatibility Facade
 *
 * This facade maintains backward compatibility for existing imports
 * while the implementation has been moved to the services directory.
 *
 * @deprecated Import directly from services/unified-template-processor.ts instead
 */

// Re-export everything from the canonical implementation
export * from "./services/unified-template-processor.ts";
