/**
 * Climpt Schema Models and Type Definitions
 *
 * Domain models and interfaces for the Climpt command registry system.
 * Extracted from climpt-adapter.ts for better organization.
 */

/**
 * Climpt command registry schema definition
 */
export interface ClimptRegistrySchema {
  version: string;
  description: string;
  tools: {
    availableConfigs: string[];
    commands: ClimptCommand[];
  };
}

/**
 * Climpt command structure
 */
export interface ClimptCommand {
  c1: string; // Domain/category
  c2: string; // Action/directive
  c3: string; // Target/layer
  description: string;
  usage?: string;
  options?: {
    input?: string[];
    adaptation?: string[];
    input_file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };
}
