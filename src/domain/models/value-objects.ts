/**
 * Domain Value Objects - Backward Compatibility Re-exports
 *
 * This file maintains backward compatibility after splitting the original
 * large value-objects.ts file into smaller, focused modules for AI complexity
 * control compliance (200-line limit).
 *
 * Original file: 782 lines (391% over 200-line limit)
 * Split into 4 files: ~200 lines each for optimal AI cognitive load management
 *
 * Split files:
 * - document-value-objects.ts: Document-related value objects
 * - configuration-value-objects.ts: Configuration path value objects
 * - schema-value-objects.ts: Schema definition and version value objects
 * - template-value-objects.ts: Template and processing value objects
 */

export * from "./value-objects/index.ts";
