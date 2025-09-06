/**
 * Core Domain Types - Unified Export Module
 *
 * This file has been refactored to split large type definitions into focused modules
 * following AI complexity control principles (200-line limit per file).
 *
 * All types are re-exported here for backward compatibility.
 */

// Re-export all command-related types
export * from "./command-types.ts";

// Re-export all analysis-related types
export * from "./analysis-types.ts";

// Re-export all domain-specific types
export * from "./domain-types.ts";

// Re-export core result types
export type { Result } from "./result.ts";

// Import Command type for backward compatibility aliases
import type { Command } from "./command-types.ts";

// Additional type aliases for backward compatibility
export type RegistryEntry = Command;
export type MappedEntry = Command;

// Note: This file now serves as a unified export point for all domain types
// while the actual implementations are organized into focused, maintainable modules.
// Each split file follows DDD principles and maintains the same API contracts.
