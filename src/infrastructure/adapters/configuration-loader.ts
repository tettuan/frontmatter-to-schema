/**
 * Configuration Loader - Refactored using ConfigurationOrchestrator
 *
 * This file now serves as a compatibility layer for the ConfigurationOrchestrator
 * Maintains backward compatibility while using the new DDD-compliant services
 */

export { ConfigurationOrchestrator as ConfigurationLoader } from "./configuration-orchestrator.ts";
