/**
 * Environment Configuration - Centralized environment variable management
 * Following prohibit-hardcoding regulations
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import type { EnvironmentRepository } from "../repositories/file-system-repository.ts";

/**
 * Environment variable names as constants
 */
export const ENV_VARS = {
  VERBOSE_MODE: "FRONTMATTER_VERBOSE_MODE",
  DEBUG_MODE: "FRONTMATTER_TO_SCHEMA_DEBUG",
  DEBUG_MODE_LEGACY: "FRONTMATTER_DEBUG",
  NODE_ENV: "NODE_ENV",
  LOG_LEVEL: "LOG_LEVEL",
  CLAUDE_API_KEY: "CLAUDE_API_KEY",
  BREAKDOWN_LOG: "BREAKDOWN_LOG",
} as const;

/**
 * Environment configuration class for centralized env var management
 */
export class EnvironmentConfig {
  private static instance: EnvironmentConfig | null = null;
  private cache: Map<string, string | undefined> = new Map();

  private constructor(
    private readonly environmentRepo?: EnvironmentRepository,
  ) {}

  /**
   * Get singleton instance
   */
  static getInstance(
    environmentRepo?: EnvironmentRepository,
  ): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig(environmentRepo);
    }
    return EnvironmentConfig.instance;
  }

  /**
   * Get environment variable value with caching
   */
  private getEnvVar(key: string): string | undefined {
    if (!this.cache.has(key)) {
      // Use repository if available, otherwise fall back to Deno.env for backward compatibility
      const value = this.environmentRepo?.get(key) ?? Deno.env.get(key);
      this.cache.set(key, value);
    }
    return this.cache.get(key);
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get verbose mode setting
   */
  getVerboseMode(): boolean {
    return this.getEnvVar(ENV_VARS.VERBOSE_MODE) === "true";
  }

  /**
   * Get debug mode setting (with legacy support)
   */
  getDebugMode(): boolean {
    return this.getEnvVar(ENV_VARS.DEBUG_MODE) === "true" ||
      this.getEnvVar(ENV_VARS.DEBUG_MODE_LEGACY) === "true";
  }

  /**
   * Get breakdown log setting
   */
  getBreakdownLogEnabled(): boolean {
    return this.getEnvVar(ENV_VARS.BREAKDOWN_LOG) === "true";
  }

  /**
   * Get node environment
   */
  getNodeEnv(): string {
    return this.getEnvVar(ENV_VARS.NODE_ENV) || "development";
  }

  /**
   * Get log level
   */
  getLogLevel(): string {
    return this.getEnvVar(ENV_VARS.LOG_LEVEL) || "info";
  }

  /**
   * Get Claude API key
   */
  getClaudeApiKey(): Result<string, DomainError & { message: string }> {
    const apiKey = this.getEnvVar(ENV_VARS.CLAUDE_API_KEY);
    if (!apiKey) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "CLAUDE_API_KEY",
        }, "Claude API key is not configured in environment variables"),
      };
    }
    return { ok: true, data: apiKey };
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.getNodeEnv() === "production";
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.getNodeEnv() === "development";
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.getNodeEnv() === "test";
  }

  /**
   * Get custom environment variable
   */
  getCustom(key: string, defaultValue?: string): string | undefined {
    return this.getEnvVar(key) || defaultValue;
  }
}

// Export singleton instance getter for convenience
export const getEnvironmentConfig = (
  environmentRepo?: EnvironmentRepository,
): EnvironmentConfig => {
  return EnvironmentConfig.getInstance(environmentRepo);
};
