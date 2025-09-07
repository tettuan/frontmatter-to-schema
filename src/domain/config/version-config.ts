/**
 * Version Configuration Value Object
 * 
 * Following DDD principles and Totality to ensure type-safe version management
 * Eliminates hardcoding violations by centralizing version configuration
 */

import type { Result } from "../core/result.ts";

/**
 * Version Configuration Value Object
 * Immutable representation of application version configuration
 */
export class VersionConfig {
  private constructor(
    private readonly version: string,
    private readonly fallbackVersion: string,
  ) {}

  /**
   * Get the current version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get the fallback version for defaults
   */
  getFallbackVersion(): string {
    return this.fallbackVersion;
  }

  /**
   * Create VersionConfig from environment or defaults
   * Totality: Always returns a valid VersionConfig
   */
  static create(): VersionConfig {
    const version = Deno.env.get("APP_VERSION") || 
                   Deno.env.get("VERSION") || 
                   "1.0.0";
    
    const fallbackVersion = Deno.env.get("FALLBACK_VERSION") || "1.0.0";
    
    return new VersionConfig(version, fallbackVersion);
  }

  /**
   * Create VersionConfig with specific values
   * Used for testing and specific contexts
   */
  static createWithValues(
    version: string,
    fallbackVersion?: string,
  ): Result<VersionConfig, { message: string }> {
    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+(-.*)?$/;
    
    if (!versionRegex.test(version)) {
      return {
        ok: false,
        error: { message: `Invalid version format: ${version}` },
      };
    }
    
    const fallback = fallbackVersion || version;
    if (!versionRegex.test(fallback)) {
      return {
        ok: false,
        error: { message: `Invalid fallback version format: ${fallback}` },
      };
    }
    
    return {
      ok: true,
      data: new VersionConfig(version, fallback),
    };
  }

  /**
   * Check equality
   */
  equals(other: VersionConfig): boolean {
    return this.version === other.version &&
           this.fallbackVersion === other.fallbackVersion;
  }

  /**
   * String representation
   */
  toString(): string {
    return this.version;
  }
}

/**
 * Application-wide constants to replace magic strings
 * Following prohibit-hardcoding policy
 */
export const AppConstants = {
  FILE_PREFIX: "f",
  UNKNOWN_VALUE: "unknown",
  DEFAULT_DESCRIPTION: "Registry generated from markdown frontmatter",
  DEFAULT_DOCUMENT_PATH: "unknown",
} as const;

/**
 * Singleton instance for application-wide version configuration
 */
let versionConfigInstance: VersionConfig | null = null;

/**
 * Get the singleton VersionConfig instance
 * Lazy initialization ensures environment variables are read at runtime
 */
export function getVersionConfig(): VersionConfig {
  if (!versionConfigInstance) {
    versionConfigInstance = VersionConfig.create();
  }
  return versionConfigInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetVersionConfig(): void {
  versionConfigInstance = null;
}