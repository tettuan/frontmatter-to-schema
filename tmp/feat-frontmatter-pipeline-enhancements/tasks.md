# DDD実装タスク

## フェーズ1: 準備と理解

- [x] ドメイン境界設計書を読む
- [x] 全域性原則を理解
- [x] ドメインアーキテクチャ設計完了
- [x] 既存実装の調査
  - ClaudeAnalyzerAdapterが存在（claude -p実行済み）
  - TemplateMapperがTypeScriptで処理（要変更）
  - Smart Constructor/Result型が既に実装済み

## フェーズ2: コアドメイン実装

### 2.1 フロントマター抽出ドメイン

- [ ] `src/domain/core/frontmatter/` ディレクトリ作成
- [ ] FrontMatter値オブジェクト実装
- [ ] MarkdownDocument実体実装
- [ ] FrontMatterExtractorサービス実装
- [ ] テスト作成

### 2.2 AI解析ドメイン

- [ ] `src/domain/core/ai-analysis/` ディレクトリ作成
- [ ] ExtractedInfo値オブジェクト実装
- [ ] StructuredData値オブジェクト実装
- [ ] Template値オブジェクト実装
- [ ] AIAnalysisOrchestrator実装
- [ ] ClaudeAIProviderアダプター実装
- [ ] テスト作成

### 2.3 Schema管理ドメイン

- [ ] `src/domain/core/schema/` ディレクトリ作成
- [ ] AnalysisSchema値オブジェクト実装
- [ ] SchemaRepository実装
- [ ] テスト作成

### 2.4 テンプレート管理ドメイン

- [ ] `src/domain/core/template/` ディレクトリ作成
- [ ] Template値オブジェクト実装
- [ ] TemplateRepository実装
- [ ] テスト作成

### 2.5 結果統合ドメイン

- [ ] `src/domain/core/integration/` ディレクトリ作成
- [ ] ResultAggregator実装
- [ ] FinalResult値オブジェクト実装
- [ ] テスト作成

## フェーズ3: サポートドメイン実装

- [ ] ファイル管理ドメイン実装
- [ ] 設定管理ドメイン実装
- [ ] プロンプト管理ドメイン実装

## フェーズ4: イベント駆動アーキテクチャ

- [ ] EventBus実装
- [ ] ドメインイベント定義
- [ ] イベントハンドラー実装

## フェーズ5: 統合とテスト

- [ ] 全ドメイン統合テスト
- [ ] `deno test` 全テストパス
- [ ] `deno task ci:dirty` パス

## 進捗

- 開始: 2025-08-22
- 現在: フェーズ1 - 既存実装の調査開始
