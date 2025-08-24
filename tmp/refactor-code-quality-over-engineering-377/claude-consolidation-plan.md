# Claude Analyzer Consolidation Plan

## Current Structure
1. `ClaudeAnalyzerAdapter` - Implements `AIAnalyzerPort`
   - Used in `application/cli.ts` as aiAnalyzer
   - Handles general AI analysis requests
   
2. `ClaudeSchemaAnalyzer` - Implements `SchemaAnalyzer`
   - Used in `main.ts` as analyzer
   - Specialized for schema analysis with prompts

## Consolidation Strategy
Create a single `ClaudeAnalyzer` class that:
1. Implements both `AIAnalyzerPort` and `SchemaAnalyzer` interfaces
2. Uses method overloading to handle both types of analysis
3. Similar pattern to the existing `MockAnalyzer`

## Implementation Steps
1. Create new consolidated `claude-analyzer.ts`
2. Implement both interfaces with method overloading
3. Update imports in `cli.ts` and `main.ts`
4. Delete old files
5. Run tests to verify

## Benefits
- Reduces 2 files to 1
- Consistent with MockAnalyzer pattern
- Easier to maintain
- Less code duplication
