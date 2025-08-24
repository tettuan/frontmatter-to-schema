# テンプレート処理重複箇所分析

## 発見された重複処理

### 1. テンプレート読み込み処理

**場所1**: `src/infrastructure/template/file-template-repository.ts`

- ファイルシステムからのテンプレート読み込み
- 複数フォーマット対応 (JSON, YAML, Handlebars)
- キャッシュ機能

**場所2**: `src/infrastructure/adapters/simple-template-mapper.ts`

- JSON/YAML テンプレート解析処理
- プレースホルダー置換処理

### 2. テンプレートフォーマット解析

**重複要素**:

- JSON解析: `parseJSONTemplate()`
- YAML解析: `parseYAMLTemplate()` (簡易版)
- プレースホルダー置換: `replacePlaceholders()`

## ドメイン境界分析

### 現在の配置

- `FileTemplateRepository`: Infrastructure層のTemplate管理
- `SimpleTemplateMapper`: Infrastructure層のTemplate適用

### ドメイン境界書に基づく理想的な配置

**CD4: Template Management Domain**

- 責務: 解析テンプレートの管理と適用
- 集約ルート: `TemplateRepository`
- 境界コンテキスト: テンプレート定義ファイル → 適用可能なテンプレート

## 問題点

1. **職責分離不足**: テンプレート読み込みと適用処理が分散
2. **重複実装**: JSON/YAML解析処理が複数箇所に存在
3. **Totality原則違反**: エラーハンドリングが統一されていない
4. **DDD境界違反**: Infrastructure層で業務ロジックが混在

## 統合方針

### Phase 1: Template Domain の強化

1. `TemplateRepository` を核心として、読み込み・解析・適用を統合
2. Template Processing Service の新設
3. 共通のTemplate Processor の実装

### Phase 2: 重複コード統合

1. JSON/YAML解析処理の統一化
2. プレースホルダー処理の共通化
3. エラーハンドリングのTotality原則適用

### Phase 3: ドメイン境界の正規化

1. Infrastructure層から業務ロジックを Domain層へ移動
2. Pure Function化によるテスタビリティ向上
3. Smart Constructor パターンの適用
