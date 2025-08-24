# Factory Consolidation Refactoring Tasks

## Issue #357: Remove deprecated AnalysisEngineFactory and consolidate factory pattern

### 1. 資料を読んで、ドメイン設計と Totality を理解する
- [x] Totality原則の理解 (docs/development/totality.ja.md)
- [x] AI複雑化防止フレームワークの理解 (docs/development/ai-complexity-control_compact.ja.md)
- [x] ドメイン境界の理解 (docs/domain/domain-boundary.md)
- [ ] 現在のファクトリーパターンの分析

### 2. 調査結果を記録する
- [ ] 現在のファクトリー実装の一覧作成
- [ ] 削除対象の特定 (AnalysisEngineFactory)
- [ ] 統合先の確認 (component-factory.ts)
- [ ] 影響範囲の調査

### 3. リファクタリング実施
- [ ] AnalysisEngineFactoryの利用箇所を特定
- [ ] AnalysisEngineFactoryの呼び出しをAnalysisDomainFactoryに置き換え
- [ ] AnalysisEngineFactoryを削除
- [ ] 他の重複ファクトリーパターンの特定と統合
- [ ] Totalityに基づく型安全性の強化

### 4. テスト修正
- [ ] 影響を受けるテストファイルの特定
- [ ] テストの修正
- [ ] 新しいテストの追加（必要に応じて）

### 5. 検証
- [ ] ユニットテストの実行 (deno test src/)
- [ ] 統合テストの実行 (deno task ci:dirty)
- [ ] エントロピー削減の確認

## 現在の状況

### 確認済みファクトリー実装
1. **component-factory.ts** (統合先)
   - MasterComponentFactory (新しい統合ファクトリー)
   - AnalysisDomainFactory
   - TemplateDomainFactory
   - PipelineDomainFactory
   - FactoryConfigurationBuilder

2. **analysis-engine.ts** (削除対象)
   - AnalysisEngineFactory (@deprecated マーク付き)

3. **その他のファクトリー**
   - TemplateFormatHandlerFactory (template/format-handlers.ts)
   - PlaceholderProcessorFactory (template/placeholder-processor.ts)
   - SchemaAnalysisFactory (analysis/schema-driven.ts)
   - DynamicPipelineFactory (core/schema-management.ts)

## エントロピー削減目標
- ファクトリークラス数の削減
- 重複実装の排除
- 統一されたファクトリーパターンの確立
- 型安全性の向上（Totality原則）