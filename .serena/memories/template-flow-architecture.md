# Template Flow Architecture

## 核心原則

TypeScriptでテンプレートを解析する必要はない。`Claude Code SDK`
へテンプレート当て込みプロンプトと一緒に、テンプレートを渡し、返却結果を受け取るだけである。

## 実装方針

- NG: TypeScriptでの当て込み
- OK: `Claude Code SDK` での変換結果を受け取るだけ

## テンプレートからの変換フロー

### Inputs

1. テンプレート当て込みのprompt
2. Schema
3. テンプレート

### Process

`Claude Code SDK` がすべての入力を処理

### Output

変換後テンプレート（統合にそのまま利用）

## 実装ファイル

### AITemplateMapper (src/domain/services/ai-template-mapper.ts)

- テンプレート適用をAIに委譲
- プロンプトビルダーで的確な指示を生成
- TypeScriptは結果の受け取りのみ

### AIAnalysisOrchestrator (src/domain/core/ai-analysis-orchestrator.ts)

- 2段階処理フロー
- Stage 1: 情報抽出
- Stage 2: テンプレート適用
- 変換後テンプレートは統合にそのまま利用
