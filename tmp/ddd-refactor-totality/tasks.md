# リファクタリングタスクリスト

## Phase 1: Totality原則の適用強化

### 1.1 Result型への完全移行

- [ ] src/infrastructure/adapters/*.ts - 例外処理をResult型に変換
- [ ] src/application/services/*.ts - null/undefined返却をResult型に変換
- [ ] src/application/use-cases/*.ts - エラーハンドリングの改善
- [ ] src/domain/services/*.ts - 部分関数の全域関数化

### 1.2 Smart Constructorの追加導入

- [ ] src/domain/registry/types.ts - RegistryEntry型の制約強化
- [ ] src/application/configuration.ts - 設定値のバリデーション強化
- [ ] src/infrastructure/ports/*.ts - ポート層の値型強化

### 1.3 Discriminated Unionへの変換

- [ ] オプショナルプロパティを持つインターフェースの見直し
- [ ] 状態管理の明確化（loading/success/error状態など）

## Phase 2: DDD境界の整理

### 2.1 Schema非依存コアの分離

- [ ] src/domain/core/abstractions.ts - Schema依存の除去
- [ ] src/domain/frontmatter/Extractor.ts - 純粋な抽出ロジック
- [ ] src/domain/shared/*.ts - Schema非依存の共通型

### 2.2 Schema注入層の実装

- [ ] Schema注入コンテナの作成
- [ ] 実行時Schema切り替え機能
- [ ] SchemaContextの導入

### 2.3 動的Schema管理層の構築

- [ ] SchemaLoaderの実装
- [ ] SchemaSwitcherの実装
- [ ] ActiveSchema管理

## Phase 3: インフラストラクチャ層の改善

### 3.1 依存性注入の実装

- [ ] src/infrastructure/adapters/claude-schema-analyzer.ts - Schema注入対応
- [ ] src/infrastructure/adapters/simple-template-mapper.ts - Template注入対応
- [ ] src/infrastructure/adapters/configuration-loader.ts - 動的設定対応

### 3.2 ファクトリーパターンの導入

- [ ] ProcessorFactoryの実装
- [ ] ValidatorFactoryの実装
- [ ] MapperFactoryの実装

## Phase 4: アプリケーション層の改善

### 4.1 ユースケースの整理

- [ ] src/application/use-cases/analyze-document.ts - Schema注入対応
- [ ] src/application/use-cases/process-documents.ts - バッチ処理改善
- [ ] src/application/usecases/BuildRegistryUseCase.ts - レジストリ構築改善

### 4.2 CLIハンドラーの改善

- [ ] src/application/cli.ts - Schema動的ロード対応
- [ ] src/application/climpt/climpt-adapter.ts - アダプター改善

## Phase 5: パイプライン層の改善

### 5.1 汎用パイプラインの実装

- [ ] src/domain/pipeline/generic-pipeline.ts - Schema非依存化
- [ ] src/domain/pipeline/analysis-pipeline.ts - 注入ベースの実装

## Phase 6: テストの更新

### 6.1 単体テストの修正

- [ ] 各ドメインモデルのテスト更新
- [ ] Smart Constructorのテスト追加
- [ ] Result型のテスト追加

### 6.2 統合テストの修正

- [ ] Schema切り替えテスト
- [ ] E2Eテストの更新

## 実装優先順位

1. **最優先**: Phase 1.1 (Result型への移行) - 型安全性の基盤
2. **高優先**: Phase 2.1 (Schema非依存コアの分離) - アーキテクチャの基盤
3. **中優先**: Phase 2.2 (Schema注入層) - 可変性の実現
4. **低優先**: Phase 3-5 - 段階的な改善

## 完了条件

- [ ] すべての部分関数が全域関数に変換された
- [ ] Schema可変性が実現された
- [ ] `deno test src/` がpass
- [ ] `deno task ci:dirty` がpass

## 注意事項

- エントロピー増大を抑制（複雑性を増やさない）
- 既存機能を維持しつつ段階的にリファクタリング
- 各変更後にテストを実行して動作確認
