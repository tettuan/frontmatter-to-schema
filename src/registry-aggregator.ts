import type { MappedEntry, Registry, RegistryEntry } from "./types.ts";

/**
 * Aggregates mapped entries to build the final registry JSON
 */
export class RegistryAggregator {
  private entries: MappedEntry[] = [];

  /**
   * Adds a mapped entry to the registry
   */
  addEntry(entry: MappedEntry): void {
    this.entries.push(entry);
  }

  /**
   * Builds the final registry object
   */
  build(): Registry {
    // Extract unique available configs from c1 values
    const availableConfigs = [...new Set(this.entries.map((entry) => entry.c1))]
      .sort();

    // Convert mapped entries to registry entries
    const commands: RegistryEntry[] = this.entries.map((entry) => ({
      c1: entry.c1,
      c2: entry.c2,
      c3: entry.c3,
      description: entry.description,
      usage: entry.usage,
      options: entry.options,
    }));

    return {
      version: "1.0.0",
      description:
        "Climpt comprehensive configuration for MCP server and command registry",
      tools: {
        availableConfigs,
        commands,
      },
    };
  }

  /**
   * Writes registry to JSON file
   */
  async writeToFile(filePath: string): Promise<void> {
    const registry = this.build();
    const jsonContent = JSON.stringify(registry, null, 2);
    await Deno.writeTextFile(filePath, jsonContent);
  }

  /**
   * Gets current entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Gets all entries
   */
  getEntries(): MappedEntry[] {
    return [...this.entries];
  }

  /**
   * Validates registry structure
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.entries.length === 0) {
      errors.push("No entries found in registry");
    }

    // Check for duplicate commands
    const commandKeys = new Set<string>();
    for (const entry of this.entries) {
      const key = `${entry.c1}/${entry.c2}/${entry.c3}`;
      if (commandKeys.has(key)) {
        errors.push(`Duplicate command found: ${key}`);
      }
      commandKeys.add(key);
    }

    // Validate required fields
    for (const entry of this.entries) {
      if (!entry.c1 || !entry.c2 || !entry.c3) {
        errors.push(
          `Missing required command fields in entry: ${JSON.stringify(entry)}`,
        );
      }
      if (!entry.description || !entry.usage) {
        errors.push(
          `Missing description or usage in entry: ${entry.c1}/${entry.c2}/${entry.c3}`,
        );
      }
      if (!entry.options || !Array.isArray(entry.options.input)) {
        errors.push(
          `Invalid options structure in entry: ${entry.c1}/${entry.c2}/${entry.c3}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
