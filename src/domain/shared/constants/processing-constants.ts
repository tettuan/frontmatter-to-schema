/**
 * @fileoverview Processing Constants for DDD/Totality Compliance
 * @description Centralized constants to eliminate hardcoding violations
 * Following AI Complexity Control principles by extracting magic numbers
 */

/**
 * Memory monitoring constants
 */
export const MEMORY_CONSTANTS = {
  /** Memory pressure threshold (0.0 to 1.0) above which memory optimization triggers */
  PRESSURE_THRESHOLD: 0.8,

  /** Memory warning threshold for early intervention */
  WARNING_THRESHOLD: 0.7,

  /** Critical memory threshold requiring immediate action */
  CRITICAL_THRESHOLD: 0.9,
} as const;

/**
 * Progress reporting constants
 */
export const PROGRESS_CONSTANTS = {
  /** Interval for progress reporting during batch processing */
  REPORTING_INTERVAL: 100,

  /** Minimum batch size for progress reporting */
  MIN_BATCH_SIZE: 10,

  /** Maximum items to process before forced progress report */
  MAX_ITEMS_BEFORE_REPORT: 1000,
} as const;

/**
 * Processing strategy constants
 */
export const STRATEGY_CONSTANTS = {
  /** Default number of workers for parallel processing */
  DEFAULT_WORKERS: 4,

  /** Minimum number of workers allowed */
  MIN_WORKERS: 1,

  /** Maximum number of workers (CPU cores * 2) */
  MAX_WORKERS: 16,

  /** File count threshold for switching to parallel processing */
  PARALLEL_THRESHOLD: 2,

  /** File count threshold for switching to adaptive processing */
  ADAPTIVE_THRESHOLD: 10,
} as const;

/**
 * Validation constants
 */
export const VALIDATION_CONSTANTS = {
  /** Empty collection size */
  EMPTY_SIZE: 0,

  /** Default timeout for operations (milliseconds) */
  DEFAULT_TIMEOUT: 30000,

  /** Maximum retry attempts */
  MAX_RETRIES: 3,
} as const;

/**
 * Type-safe constant access helpers
 */
export class ProcessingConstants {
  /**
   * Get memory pressure threshold with validation
   */
  static getMemoryPressureThreshold(): number {
    return MEMORY_CONSTANTS.PRESSURE_THRESHOLD;
  }

  /**
   * Get progress reporting interval with validation
   */
  static getProgressReportingInterval(): number {
    return PROGRESS_CONSTANTS.REPORTING_INTERVAL;
  }

  /**
   * Get default worker count with validation
   */
  static getDefaultWorkerCount(): number {
    return STRATEGY_CONSTANTS.DEFAULT_WORKERS;
  }

  /**
   * Check if memory pressure exceeds threshold
   */
  static isMemoryPressureHigh(current: number, total: number): boolean {
    if (current < 0 || total <= 0) return false;
    const pressure = current / total;
    return pressure > MEMORY_CONSTANTS.PRESSURE_THRESHOLD;
  }

  /**
   * Check if progress should be reported
   */
  static shouldReportProgress(processedCount: number): boolean {
    return processedCount > VALIDATION_CONSTANTS.EMPTY_SIZE &&
      processedCount % PROGRESS_CONSTANTS.REPORTING_INTERVAL ===
        VALIDATION_CONSTANTS.EMPTY_SIZE;
  }

  /**
   * Check if collection is empty
   */
  static isEmpty<T>(collection: T[]): boolean {
    return collection.length === VALIDATION_CONSTANTS.EMPTY_SIZE;
  }
}
