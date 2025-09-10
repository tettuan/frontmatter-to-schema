// These tests have been disabled as they test the old CLI implementation
// that was replaced to fix issue #613 (template processing bypass)
//
// The following tests were disabled:
// - CLI: Main function integration - help option
// - CLI: Main function integration - missing arguments
// - CLI: Main function integration - missing required options
// - CLI: Main function with verbose mode
// - CLI: Path validation errors
// - CLI: loadPromptTemplates function fallback
// - CLI: loadPromptTemplates function success
//
// These tests need to be rewritten to test the new CLI implementation
// in src/application/cli.ts which properly uses DocumentProcessor
