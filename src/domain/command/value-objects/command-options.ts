/**
 * Command Options Value Objects
 *
 * Defines command option types using discriminated union pattern following Totality principle.
 * Replaces optional properties with explicit states for better type safety.
 */

/**
 * Command options using discriminated union pattern (Totality principle)
 * Replaces optional properties with explicit states
 */
export type CommandOptions =
  | { kind: "basic"; hasFile: false; hasStdin: false; hasDestination: false }
  | {
    kind: "file-only";
    hasFile: true;
    file: boolean[];
    hasStdin: false;
    hasDestination: false;
  }
  | {
    kind: "stdin-only";
    hasStdin: true;
    stdin: boolean[];
    hasFile: false;
    hasDestination: false;
  }
  | {
    kind: "destination-only";
    hasDestination: true;
    destination: boolean[];
    hasFile: false;
    hasStdin: false;
  }
  | {
    kind: "full";
    input?: string[];
    adaptation?: string[];
    file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };

/**
 * Command data for creation
 */
export interface CommandCreationData {
  c1: string;
  c2: string;
  c3: string;
  description: string;
  usage: string;
  options: Record<string, unknown>;
  title?: string;
}
