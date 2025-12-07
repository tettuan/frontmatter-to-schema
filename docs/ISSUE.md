# Issue Log

## 1. ~~API ignores schema-relative `x-template` paths~~ [RESOLVED]

- **Location**: `src/api.ts:290-311`, `src/api.ts:440-462`
- **Problem**: The library APIs (`transformFiles` and
  `Transformer.transformFiles`) simply copy the raw `x-template` string from the
  schema into `PipelineConfig`. Unlike the CLI (which resolves the template
  relative to the schema directory at `src/presentation/cli/index.ts:154-265`),
  the API assumes the template path is already absolute. When a schema contains
  the common `"x-template": "./template.json"`, calling
  `transformFiles({ schema: "/path/to/schema.json", ... })` from a different
  working directory sends `./template.json` to the pipeline, which then fails to
  load the template.
- **Impact**: Programmatic consumers cannot rely on the documented convention of
  keeping schema and template files together. Features such as publishing the
  library on JSR (README.md:21-27) break unless callers resolve paths manually,
  defeating the purpose of encapsulating filesystem logic behind the API.
- **Resolution**: Both `transformFiles` and `Transformer.transformFiles` now
  resolve relative template paths against `dirname(options.schema)` using
  `@std/path`, matching CLI behavior. Added unit tests in
  `tests/unit/api_test.ts`.

## 2. ~~Directory inputs only scan top-level `.md` files~~ [RESOLVED]

- **Location**: `src/application/services/pipeline-orchestrator.ts:326-344`
- **Problem**: When `inputPath` is a directory, the orchestrator lists only the
  immediate entries and filters with `/\.md(own)?$/`. This (a) ignores
  `.markdown` files even though glob handling includes them, and (b) never
  recurses into subdirectories. README.md:25 advertises "Process single files,
  directories, or glob patterns", but directory support is effectively "one
  level of `.md` files only".
- **Impact**: Common layouts such as `docs/**/*.md` or `.markdown` extensions
  are silently skipped when users pass a directory path (e.g.,
  `transformFiles({ input: "./docs" })`). The CLI works because it calls
  `resolveInputToFiles`, so the behaviour discrepancy is confusing and hard to
  diagnose.
- **Resolution**: Added `walkDirectoryForMarkdown()` private method to
  PipelineOrchestrator that recursively walks directories through
  FileSystemPort, supporting `.md`, `.mdown`, and `.markdown` extensions. This
  maintains port abstraction for custom adapters. Added unit tests in
  `tests/unit/application/services/pipeline-orchestrator_test.ts`.

## 3. ~~`x-derived-from` rewrites both type and ordering~~ [RESOLVED]

- **Location**:
  `src/domain/schema/services/schema-directive-processor.ts:247-264`
- **Problem**: After collecting values with `DataPathResolver`, the
  implementation converted every item to `String(v)` and then sorted the
  resulting array alphabetically before setting the derived property. The spec
  explicitly says derived values "Preserve order of extraction"
  (docs/schema-extensions.md:102) and does not restrict them to strings.
- **Impact**: Any non-string data (numbers, objects, booleans) coming from
  nested frontmatter was coerced to strings and reordered, so downstream
  templates could not rely on original types or chronological ordering (e.g.,
  changelog dates, priority numbers, or bool flags). `x-derived-unique` also
  became unreliable because uniqueness was applied after stringification.
- **Resolution**: Removed the string coercion (`.map((v) => String(v))`) and the
  unconditional `.sort()`. Values now preserve their original types and
  extraction order. Updated `x-derived-unique` to use JSON.stringify for deep
  equality comparison, properly handling objects/arrays. Added unit tests in
  `tests/unit/domain/schema/services/schema-directive-processor_test.ts`
  covering order preservation, number/boolean/object type preservation, and
  mixed-type uniqueness.

## 4. ~~`x-template-format` / YAML templates are impossible~~ [RESOLVED]

- **Location**: `src/domain/shared/value-objects/template-path.ts:34-45`,
  `src/application/services/template-schema-coordinator.ts:224-339`
- **Problem**: `TemplatePath.create` rejected every path that did not end with
  `.json`, and `TemplateSchemaCoordinator.loadTemplate` always parsed files as
  JSON (`format: "json"`). Yet the documentation describes `x-template-format`
  and shows `"x-template-format": "yaml"` (docs/schema-extensions.md:658-680).
  As a result, supplying a `.yaml` template or a schema-level format hint
  immediately raised `INVALID_TEMPLATE_PATH`/`TEMPLATE_PARSE_ERROR`.
- **Impact**: Users could not deliver YAML-first templates or use
  `x-template-format` despite the directive existing, the value object being
  implemented, and the CLI help text advertising it.
- **Resolution**: Updated `TemplatePath` in shared domain to accept `.json`,
  `.yml`, and `.yaml` extensions. Modified
  `TemplateSchemaCoordinator.loadTemplate` to detect format from file extension
  (with `x-template-format` override priority) and parse YAML templates via
  `@std/yaml`. The parsed format is passed through to the Template entity. Added
  unit tests in
  `tests/unit/domain/shared/value-objects/template-path-shared_test.ts` for YAML
  extension validation.

## 5. ~~Phase 1 `x-flatten-arrays` ignores scalars/nulls~~ [RESOLVED]

- **Location**:
  `src/domain/directives/services/phase1-directive-processor.ts:133-188`,
  `docs/requirements.ja.md:253`
- **Problem**: Phase 1 is supposed to normalise each document _before_
  aggregation so that later steps can assume consistent array shape
  (requirements pictogram: docs/requirements.ja.md:232-274). However the current
  implementation only runs whenever `Array.isArray(value)` is true. Values such
  as a plain string (`traceability: "REQ-004"`), a number, or even `null` are
  left untouched, despite the spec explicitly calling out those cases and
  despite the value object
  (`src/domain/schema/value-objects/flatten-arrays-directive.ts`) already
  supporting "wrap scalars" and "null → []". In other words we duplicated the
  directive logic, but the duplicate implements a strict subset of the rules.
- **Impact**: Every downstream component assumes Phase 1 produced an array:
  `SchemaTemplateResolver` records the nested property name, the coordinator
  extracts it via `TemplateRenderer.renderWithItems`, and `ItemsProcessor` tries
  to iterate it. When a file contains a scalar value, Phase 1 leaves it as-is,
  so `TemplateRenderer` sees `typeof value === "string"` and silently drops it
  because it only `flatMap`s actual arrays. The symptom is that documents
  missing the canonical array shape vanish from `{@items}` with no warning even
  though the schema promised they would be normalised. Worse, the behaviour
  diverges between Phase 1 (partial flatten) and Phase 2 (full flatten via
  `FlattenArraysDirective`), so the same directive means two different things
  depending on where it executes.
- **Resolution**: Replaced the custom flattening code in Phase 1 with
  `FlattenArraysDirective.create(...).apply(...)` to ensure consistent semantics
  between phases: null/undefined → empty array, scalar → `[value]`, nested
  arrays recursively flattened. Added 6 unit tests in
  `tests/unit/domain/directives/services/phase1-directive-processor_test.ts`
  covering scalar wrapping, null handling, undefined handling, numeric scalars,
  and spec examples from docs/requirements.ja.md:253 (`["A", ["B"]]`, `"D"`).

## 6. ~~Custom `FileSystemPort` adapters cannot process directories/globs~~ [RESOLVED]

- **Location**: `src/api.ts:105-129`,
  `src/application/services/pipeline-orchestrator.ts:319-382`,
  `src/infrastructure/utils/input-resolver.ts:1-193`
- **Problem**: The public API advertised a pluggable filesystem
  (`TransformerOptions.fileSystem`) that let callers supply their own adapter.
  This worked as long as the pipeline only read concrete files. But the moment
  the input was a directory or a glob, the orchestrator gave up on the adapter
  and called `resolveInputToFiles`, which used `Deno.cwd()`, `Deno.stat`, and
  `expandGlob` directly. Any custom filesystem was ignored. Half the pipeline
  used the adapter, the other half used the real OS.
- **Impact**: People who passed an in-memory filesystem (tests), a remote
  filesystem, or a sandboxed adapter could read single files just fine but
  failed as soon as they tried `input: "./docs"` or `"docs/**/*.md"`. The code
  suddenly touched host APIs they didn't expose, so nothing got processed.
- **Resolution**: Added optional `expandGlob(pattern, root)` and `cwd()` methods
  to `FileSystemPort` interface. Implemented these in `DenoFileSystemAdapter`.
  Created `resolveInputToFilesWithPort()` function that uses the port's methods
  for glob expansion, with fallback to walking directories via `readDir` when
  `expandGlob` is not available. Updated `PipelineOrchestrator.execute()` to
  detect glob patterns first and route them through the port-aware resolver.
  Non-existent paths now return `INPUT_NOT_FOUND` error instead of silently
  falling through. Added 3 unit tests in
  `tests/unit/application/services/pipeline-orchestrator_test.ts` covering glob
  pattern handling, no-match errors, and custom adapter cwd usage.

---

Latest update: Maintains running list of high-impact issues discovered during
the review.
