import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Performance profile types
 */
export type PerformanceProfile = "conservative" | "balanced" | "aggressive";

/**
 * Raw configuration data structure for performance settings
 */
export interface RawPerformanceConfig {
  readonly version: string;
  readonly description: string;
  readonly schemaProcessing: {
    readonly cache: {
      readonly enablePathCache: boolean;
      readonly enableExtractionCache: boolean;
      readonly enableMetrics: boolean;
      readonly description: string;
    };
    readonly concurrency: {
      readonly maxConcurrentExtractions: number;
      readonly maxConcurrentValidations: number;
      readonly maxConcurrentTransformations: number;
      readonly description: string;
    };
    readonly parallelProcessing: {
      readonly minFilesForParallel: number;
      readonly defaultMaxWorkers: number;
      readonly maxWorkersLimit: number;
      readonly description: string;
    };
    readonly optimization: {
      readonly enableStreamingProcessing: boolean;
      readonly enableBatchOptimization: boolean;
      readonly enableMemoryOptimization: boolean;
      readonly description: string;
    };
  };
  readonly fileSystem: {
    readonly concurrency: {
      readonly maxConcurrentReads: number;
      readonly maxConcurrentWrites: number;
      readonly description: string;
    };
    readonly caching: {
      readonly enableFileCache: boolean;
      readonly cacheExpiry: number;
      readonly maxCacheSize: number;
      readonly description: string;
    };
  };
  readonly memory: {
    readonly limits: {
      readonly maxHeapUsage: number;
      readonly maxBufferSize: number;
      readonly description: string;
    };
    readonly optimization: {
      readonly enableGarbageCollection: boolean;
      readonly gcInterval: number;
      readonly description: string;
    };
  };
  readonly profiles: {
    readonly conservative: {
      readonly schemaProcessing: {
        readonly maxConcurrentExtractions: number;
        readonly maxConcurrentValidations: number;
      };
      readonly fileSystem: {
        readonly maxConcurrentReads: number;
        readonly maxConcurrentWrites: number;
      };
      readonly parallelProcessing: {
        readonly minFilesForParallel: number;
        readonly defaultMaxWorkers: number;
      };
      readonly description: string;
    };
    readonly balanced: {
      readonly schemaProcessing: {
        readonly maxConcurrentExtractions: number;
        readonly maxConcurrentValidations: number;
      };
      readonly fileSystem: {
        readonly maxConcurrentReads: number;
        readonly maxConcurrentWrites: number;
      };
      readonly parallelProcessing: {
        readonly minFilesForParallel: number;
        readonly defaultMaxWorkers: number;
      };
      readonly description: string;
    };
    readonly aggressive: {
      readonly schemaProcessing: {
        readonly maxConcurrentExtractions: number;
        readonly maxConcurrentValidations: number;
      };
      readonly fileSystem: {
        readonly maxConcurrentReads: number;
        readonly maxConcurrentWrites: number;
      };
      readonly parallelProcessing: {
        readonly minFilesForParallel: number;
        readonly defaultMaxWorkers: number;
      };
      readonly description: string;
    };
  };
  readonly features: {
    readonly enableVarianceMonitoring: boolean;
    readonly enablePerformanceMetrics: boolean;
    readonly enableProfileSwitching: boolean;
    readonly enableDynamicAdjustment: boolean;
  };
  readonly fallback: {
    readonly profile: PerformanceProfile;
    readonly maxConcurrentExtractions: number;
    readonly enableAllOptimizations: boolean;
  };
}

/**
 * Performance Settings Configuration Value Object
 *
 * Replaces hardcoded performance parameters with configurable,
 * profile-based performance tuning following DDD principles
 */
export class PerformanceSettings {
  private constructor(
    private readonly config: RawPerformanceConfig,
    private currentProfile: PerformanceProfile = "balanced",
  ) {}

  /**
   * Smart constructor following Totality principle
   */
  static create(
    config: RawPerformanceConfig,
  ): Result<PerformanceSettings, DomainError & { message: string }> {
    // Validate configuration structure
    if (
      !config.schemaProcessing || !config.fileSystem || !config.memory ||
      !config.profiles || !config.schemaProcessing.parallelProcessing
    ) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Invalid performance settings configuration: missing required sections",
        }),
      };
    }

    // Validate concurrency limits
    const maxExtractions =
      config.schemaProcessing.concurrency.maxConcurrentExtractions;
    if (maxExtractions < 1 || maxExtractions > 1000) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "maxConcurrentExtractions must be between 1 and 1000",
        }),
      };
    }

    // Validate memory limits
    const maxHeap = config.memory.limits.maxHeapUsage;
    if (maxHeap < 64 || maxHeap > 8192) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "maxHeapUsage must be between 64 and 8192 MB",
        }),
      };
    }

    // Validate parallel processing limits
    const minFiles =
      config.schemaProcessing.parallelProcessing.minFilesForParallel;
    if (minFiles < 1 || minFiles > 100) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "minFilesForParallel must be between 1 and 100",
        }),
      };
    }

    const defaultWorkers =
      config.schemaProcessing.parallelProcessing.defaultMaxWorkers;
    if (defaultWorkers < 1 || defaultWorkers > 32) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "defaultMaxWorkers must be between 1 and 32",
        }),
      };
    }

    // Validate profile exists
    const fallbackProfile = config.fallback.profile;
    if (!config.profiles[fallbackProfile]) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `Invalid fallback profile: ${fallbackProfile}`,
        }),
      };
    }

    return ok(new PerformanceSettings(config, fallbackProfile));
  }

  /**
   * Create default configuration for fallback scenarios
   */
  static createDefault(): Result<
    PerformanceSettings,
    DomainError & { message: string }
  > {
    const defaultConfig: RawPerformanceConfig = {
      version: "1.0.0",
      description: "Default performance settings configuration",
      schemaProcessing: {
        cache: {
          enablePathCache: true,
          enableExtractionCache: true,
          enableMetrics: true,
          description: "Default caching configuration",
        },
        concurrency: {
          maxConcurrentExtractions: 20,
          maxConcurrentValidations: 15,
          maxConcurrentTransformations: 10,
          description: "Default concurrency limits",
        },
        parallelProcessing: {
          minFilesForParallel: 2,
          defaultMaxWorkers: 4,
          maxWorkersLimit: 16,
          description: "Default parallel processing configuration",
        },
        optimization: {
          enableStreamingProcessing: true,
          enableBatchOptimization: false,
          enableMemoryOptimization: true,
          description: "Default optimization strategies",
        },
      },
      fileSystem: {
        concurrency: {
          maxConcurrentReads: 50,
          maxConcurrentWrites: 25,
          description: "Default file system concurrency",
        },
        caching: {
          enableFileCache: true,
          cacheExpiry: 300000,
          maxCacheSize: 100,
          description: "Default file caching",
        },
      },
      memory: {
        limits: {
          maxHeapUsage: 512,
          maxBufferSize: 64,
          description: "Default memory limits",
        },
        optimization: {
          enableGarbageCollection: true,
          gcInterval: 30000,
          description: "Default memory optimization",
        },
      },
      profiles: {
        conservative: {
          schemaProcessing: {
            maxConcurrentExtractions: 5,
            maxConcurrentValidations: 3,
          },
          fileSystem: {
            maxConcurrentReads: 10,
            maxConcurrentWrites: 5,
          },
          parallelProcessing: {
            minFilesForParallel: 5,
            defaultMaxWorkers: 2,
          },
          description: "Conservative profile",
        },
        balanced: {
          schemaProcessing: {
            maxConcurrentExtractions: 20,
            maxConcurrentValidations: 15,
          },
          fileSystem: {
            maxConcurrentReads: 50,
            maxConcurrentWrites: 25,
          },
          parallelProcessing: {
            minFilesForParallel: 2,
            defaultMaxWorkers: 4,
          },
          description: "Balanced profile",
        },
        aggressive: {
          schemaProcessing: {
            maxConcurrentExtractions: 100,
            maxConcurrentValidations: 75,
          },
          fileSystem: {
            maxConcurrentReads: 200,
            maxConcurrentWrites: 100,
          },
          parallelProcessing: {
            minFilesForParallel: 1,
            defaultMaxWorkers: 8,
          },
          description: "Aggressive profile",
        },
      },
      features: {
        enableVarianceMonitoring: true,
        enablePerformanceMetrics: true,
        enableProfileSwitching: true,
        enableDynamicAdjustment: false,
      },
      fallback: {
        profile: "balanced",
        maxConcurrentExtractions: 20,
        enableAllOptimizations: true,
      },
    };

    return PerformanceSettings.create(defaultConfig);
  }

  /**
   * Switch to a different performance profile
   */
  switchProfile(
    profile: PerformanceProfile,
  ): Result<void, DomainError & { message: string }> {
    if (!this.config.features.enableProfileSwitching) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Profile switching is disabled in configuration",
        }),
      };
    }

    if (!this.config.profiles[profile]) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `Unknown performance profile: ${profile}`,
        }),
      };
    }

    this.currentProfile = profile;
    return ok(undefined);
  }

  /**
   * Get current performance profile
   */
  getCurrentProfile(): PerformanceProfile {
    return this.currentProfile;
  }

  /**
   * Get max concurrent extractions based on current profile
   */
  getMaxConcurrentExtractions(): number {
    const profileConfig = this.config.profiles[this.currentProfile];
    return profileConfig?.schemaProcessing.maxConcurrentExtractions ??
      this.config.schemaProcessing.concurrency.maxConcurrentExtractions;
  }

  /**
   * Get max concurrent validations based on current profile
   */
  getMaxConcurrentValidations(): number {
    const profileConfig = this.config.profiles[this.currentProfile];
    return profileConfig?.schemaProcessing.maxConcurrentValidations ??
      this.config.schemaProcessing.concurrency.maxConcurrentValidations;
  }

  /**
   * Get max concurrent file reads based on current profile
   */
  getMaxConcurrentReads(): number {
    const profileConfig = this.config.profiles[this.currentProfile];
    return profileConfig?.fileSystem.maxConcurrentReads ??
      this.config.fileSystem.concurrency.maxConcurrentReads;
  }

  /**
   * Get max concurrent file writes based on current profile
   */
  getMaxConcurrentWrites(): number {
    const profileConfig = this.config.profiles[this.currentProfile];
    return profileConfig?.fileSystem.maxConcurrentWrites ??
      this.config.fileSystem.concurrency.maxConcurrentWrites;
  }

  /**
   * Check if path cache is enabled
   */
  isPathCacheEnabled(): boolean {
    return this.config.schemaProcessing.cache.enablePathCache;
  }

  /**
   * Check if extraction cache is enabled
   */
  isExtractionCacheEnabled(): boolean {
    return this.config.schemaProcessing.cache.enableExtractionCache;
  }

  /**
   * Check if metrics are enabled
   */
  areMetricsEnabled(): boolean {
    return this.config.schemaProcessing.cache.enableMetrics;
  }

  /**
   * Check if streaming processing is enabled
   */
  isStreamingProcessingEnabled(): boolean {
    return this.config.schemaProcessing.optimization.enableStreamingProcessing;
  }

  /**
   * Check if batch optimization is enabled
   */
  isBatchOptimizationEnabled(): boolean {
    return this.config.schemaProcessing.optimization.enableBatchOptimization;
  }

  /**
   * Check if memory optimization is enabled
   */
  isMemoryOptimizationEnabled(): boolean {
    return this.config.schemaProcessing.optimization.enableMemoryOptimization;
  }

  /**
   * Get memory limit in MB
   */
  getMaxHeapUsage(): number {
    return this.config.memory.limits.maxHeapUsage;
  }

  /**
   * Get buffer size limit in MB
   */
  getMaxBufferSize(): number {
    return this.config.memory.limits.maxBufferSize;
  }

  /**
   * Check if variance monitoring is enabled
   */
  isVarianceMonitoringEnabled(): boolean {
    return this.config.features.enableVarianceMonitoring;
  }

  /**
   * Check if performance metrics are enabled
   */
  arePerformanceMetricsEnabled(): boolean {
    return this.config.features.enablePerformanceMetrics;
  }

  /**
   * Get all available profiles
   */
  getAvailableProfiles(): readonly PerformanceProfile[] {
    return Object.keys(this.config.profiles) as PerformanceProfile[];
  }

  /**
   * Get minimum files required for parallel processing based on current profile
   */
  getMinFilesForParallel(): number {
    const profileConfig = this.config.profiles[this.currentProfile];
    return profileConfig?.parallelProcessing.minFilesForParallel ??
      this.config.schemaProcessing.parallelProcessing.minFilesForParallel;
  }

  /**
   * Get default max workers based on current profile
   */
  getDefaultMaxWorkers(): number {
    const profileConfig = this.config.profiles[this.currentProfile];
    return profileConfig?.parallelProcessing.defaultMaxWorkers ??
      this.config.schemaProcessing.parallelProcessing.defaultMaxWorkers;
  }

  /**
   * Get max workers limit
   */
  getMaxWorkersLimit(): number {
    return this.config.schemaProcessing.parallelProcessing.maxWorkersLimit;
  }

  /**
   * Get fallback settings when configuration fails
   */
  getFallbackSettings(): {
    readonly profile: PerformanceProfile;
    readonly maxConcurrentExtractions: number;
    readonly enableAllOptimizations: boolean;
  } {
    return this.config.fallback;
  }
}
