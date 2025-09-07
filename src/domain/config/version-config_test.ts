/**
 * Tests for VersionConfig Value Object
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  AppConstants,
  getVersionConfig,
  resetVersionConfig,
  VersionConfig,
} from "./version-config.ts";

describe("VersionConfig", () => {
  describe("create", () => {
    it("should create VersionConfig from environment", () => {
      const config = VersionConfig.create();
      assertExists(config);
      assertExists(config.getVersion());
      assertExists(config.getFallbackVersion());
    });

    it("should use default version when no environment variable", () => {
      // Reset to ensure fresh instance
      resetVersionConfig();
      const config = VersionConfig.create();
      // Should have a version (either from env or default)
      assertExists(config.getVersion());
    });
  });

  describe("createWithValues", () => {
    it("should create VersionConfig with valid version", () => {
      const result = VersionConfig.createWithValues("2.0.0");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getVersion(), "2.0.0");
        assertEquals(result.data.getFallbackVersion(), "2.0.0");
      }
    });

    it("should create VersionConfig with version and fallback", () => {
      const result = VersionConfig.createWithValues("2.0.0", "1.0.0");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getVersion(), "2.0.0");
        assertEquals(result.data.getFallbackVersion(), "1.0.0");
      }
    });

    it("should reject invalid version format", () => {
      const result = VersionConfig.createWithValues("invalid");
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.message, "Invalid version format: invalid");
      }
    });

    it("should reject invalid fallback version format", () => {
      const result = VersionConfig.createWithValues("1.0.0", "invalid");
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(
          result.error.message,
          "Invalid fallback version format: invalid",
        );
      }
    });

    it("should accept version with pre-release tag", () => {
      const result = VersionConfig.createWithValues("1.0.0-beta.1");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getVersion(), "1.0.0-beta.1");
      }
    });
  });

  describe("equals", () => {
    it("should return true for equal configs", () => {
      const result1 = VersionConfig.createWithValues("1.0.0", "0.9.0");
      const result2 = VersionConfig.createWithValues("1.0.0", "0.9.0");
      
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (result1.ok && result2.ok) {
        assertEquals(result1.data.equals(result2.data), true);
      }
    });

    it("should return false for different versions", () => {
      const result1 = VersionConfig.createWithValues("1.0.0");
      const result2 = VersionConfig.createWithValues("2.0.0");
      
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (result1.ok && result2.ok) {
        assertEquals(result1.data.equals(result2.data), false);
      }
    });
  });

  describe("toString", () => {
    it("should return version string", () => {
      const result = VersionConfig.createWithValues("1.2.3");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "1.2.3");
      }
    });
  });

  describe("getVersionConfig singleton", () => {
    it("should return same instance", () => {
      resetVersionConfig();
      const config1 = getVersionConfig();
      const config2 = getVersionConfig();
      assertEquals(config1, config2);
    });

    it("should create new instance after reset", () => {
      const config1 = getVersionConfig();
      resetVersionConfig();
      const config2 = getVersionConfig();
      // Different instances but same behavior
      assertEquals(config1.getVersion(), config2.getVersion());
    });
  });

  describe("AppConstants", () => {
    it("should have FILE_PREFIX constant", () => {
      assertEquals(AppConstants.FILE_PREFIX, "f");
    });

    it("should have UNKNOWN_VALUE constant", () => {
      assertEquals(AppConstants.UNKNOWN_VALUE, "unknown");
    });

    it("should have DEFAULT_DESCRIPTION constant", () => {
      assertEquals(
        AppConstants.DEFAULT_DESCRIPTION,
        "Registry generated from markdown frontmatter",
      );
    });

    it("should have DEFAULT_DOCUMENT_PATH constant", () => {
      assertEquals(AppConstants.DEFAULT_DOCUMENT_PATH, "unknown");
    });
  });
});