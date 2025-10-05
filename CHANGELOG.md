# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.8] - 2025-10-05

### Added

- **Install script version display**: Added automatic version display at the end of installation script for verification

## [1.3.7] - 2025-10-05

### Fixed

- **x-frontmatter-part root-level arrays**: Fixed x-frontmatter-part directive to work uniformly regardless of array nesting. Previously only worked when arrays were nested within parent objects. Now correctly processes root-level arrays by using entire frontmatter as array element. (#1315)
  - Renamed `frontmatterPartProperty` → `nestedArrayProperty` for clarity
  - Simplified template rendering logic to always use entire frontmatter unless x-flatten-arrays is specified
  - examples/1.articles now successfully processes all 20 articles with complete field values

- **$ref resolution**: Implemented JSON Schema $ref resolution using @apidevtools/json-schema-ref-parser. Schemas can now reference external schema files using $ref. (#1314)
  - Added conditional $ref resolution - only invokes $RefParser when schema contains $ref references
  - examples/0.basic and examples/1.articles now work with $ref in schema definitions

- **Test failures**: Fixed 16 test failures caused by $ref resolution implementation. (#1316)
  - Added check for $ref presence before invoking $RefParser
  - Tests with simple schemas now parse JSON directly, avoiding MockFileSystemPort access issues
  - All 749 tests passing

### Added

- **x-flatten-arrays documentation**: Created docs/usage/x-flatten-arrays.ja.md explaining behavior and data loss implications when extracting nested arrays from frontmatter

## [1.3.2] - 2025-10-02

### Added

- Initial release with core frontmatter-to-schema functionality
- Support for x-frontmatter-part directive
- Template-based output generation
- Multi-format output support (JSON, YAML)
