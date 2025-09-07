/**
 * Dependency Injection Container for Infrastructure Services
 * Provides singleton instances of repositories for domain services
 */

import {
  DenoEnvironmentRepository,
  DenoFileSystemRepository,
} from "../adapters/deno-file-system-repository.ts";
import type {
  EnvironmentRepository,
  FileSystemRepository,
} from "../../domain/repositories/file-system-repository.ts";
import { getEnvironmentConfig } from "../../domain/config/environment-config.ts";
import type { EnvironmentConfig } from "../../domain/config/environment-config.ts";

/**
 * Global dependency container for infrastructure services
 */
export class DependencyContainer {
  private static instance: DependencyContainer | null = null;
  private environmentRepo: EnvironmentRepository | null = null;
  private fileSystemRepo: FileSystemRepository | null = null;
  private environmentConfig: EnvironmentConfig | null = null;

  private constructor() {}

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  getEnvironmentRepository(): EnvironmentRepository {
    if (!this.environmentRepo) {
      this.environmentRepo = new DenoEnvironmentRepository();
    }
    return this.environmentRepo;
  }

  getFileSystemRepository(): FileSystemRepository {
    if (!this.fileSystemRepo) {
      this.fileSystemRepo = new DenoFileSystemRepository();
    }
    return this.fileSystemRepo;
  }

  getEnvironmentConfig(): EnvironmentConfig {
    if (!this.environmentConfig) {
      this.environmentConfig = getEnvironmentConfig(
        this.getEnvironmentRepository(),
      );
    }
    return this.environmentConfig;
  }

  // For testing - allow injection of mock repositories
  setEnvironmentRepository(repo: EnvironmentRepository): void {
    this.environmentRepo = repo;
    this.environmentConfig = null; // Reset config to use new repo
  }

  setFileSystemRepository(repo: FileSystemRepository): void {
    this.fileSystemRepo = repo;
  }

  // Reset for testing
  reset(): void {
    this.environmentRepo = null;
    this.fileSystemRepo = null;
    this.environmentConfig = null;
  }
}

/**
 * Convenience functions for accessing dependencies
 */
export const getGlobalEnvironmentConfig = (): EnvironmentConfig => {
  return DependencyContainer.getInstance().getEnvironmentConfig();
};

export const getGlobalFileSystemRepository = (): FileSystemRepository => {
  return DependencyContainer.getInstance().getFileSystemRepository();
};

export const getGlobalEnvironmentRepository = (): EnvironmentRepository => {
  return DependencyContainer.getInstance().getEnvironmentRepository();
};
