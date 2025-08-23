# リファクタリング対象ファイルリスト

## 優先度1: AI解析ドメインの改善
- [ ] src/infrastructure/adapters/claude-schema-analyzer.ts - タイムアウト処理とリトライ機構の実装
- [ ] src/domain/core/ai-analysis-orchestrator.ts - Result型の統一

## 優先度2: Smart Constructor強化
- [ ] src/domain/models/value-objects.ts - 全値オブジェクトのSmart Constructor化
- [ ] src/domain/models/document.ts - DocumentPathのSmart Constructor改善

## 優先度3: エラーハンドリング統一
- [ ] src/application/use-cases/process-documents.ts - throw/catchをResult型に変換
- [ ] src/infrastructure/adapters/deno-document-repository.ts - エラー処理の統一

## 進捗状況
作業中: AI解析ドメインの改善

