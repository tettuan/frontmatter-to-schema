# 3.docs - トレーサビリティ管理システム

要件、仕様、設計、実装、テストの各レベルでトレーサビリティを管理する実用的な例です。

## 概要

プロジェクトドキュメントから階層的なトレーサビリティIDを抽出し、レベル別のインデックスを生成します。

## 成功の定義

### 1. フロントマター抽出の成功

#### トレーサビリティ構造

- `traceability`: 配列またはネストした配列として抽出される
- `id.full`: 完全なトレーサビリティID（例:
  "req:api:deepresearch-3f8d2a#20250909"）
- `id.level`: レベル識別子（req, spec, design, impl, test のいずれか）
- `id.scope`: スコープ識別子（api, user, stock等）
- `id.semantic`: 意味的な識別子
- `id.hash`: ハッシュ値
- `id.version`: バージョン番号

#### 関連フィールド

- `summary`: 要約テキスト
- `description`: 詳細説明
- `status`: ステータス（draft, approved, implemented等）
- `tags`: タグの配列
- `derived_from`: 派生元のIDリスト
- `trace_to`: トレース先のIDリスト

### 2. スキーマ検証の成功

- 全ドキュメントが`traceability_item_schema.json`に準拠する
- `id.level`が定義されたレベル（req, spec, design, impl, test）のいずれかである
- 必須フィールド（id.full, id.level, id.scope, id.semantic）が存在する

### 3. x-frontmatter-part処理の成功

- 各レベルの`traceability`配列にドキュメントが収集される
- 7個のドキュメントから適切なトレーサビリティ項目が抽出される

### 4. x-flatten-arrays処理の成功

- `"x-flatten-arrays": "traceability"`によりネストした配列がフラット化される
- 単一要素も配列として処理される
- 複数のトレーサビリティIDが1つのファイルに含まれる場合も正しく展開される

### 5. x-jmespath-filter処理の成功

#### レベル別フィルタリング

- **req_index.json**: `"[?id.level == 'req']"`により要件レベルのみ
- **spec_index.json**: `"[?id.level == 'spec']"`により仕様レベルのみ
- **design_index.json**: `"[?id.level == 'design']"`により設計レベルのみ
- **impl_index.json**: `"[?id.level == 'impl']"`により実装レベルのみ
- **test_index.json**: `"[?id.level == 'test']"`によりテストレベルのみ

### 6. テンプレート展開の成功

- `{version}`: "1.0.0"に置換される
- `{description}`: 各レベルの説明文に置換される
- `{level}`: 対応するレベル名（req, spec等）に置換される
- `{@items}`: 各レベルのtraceability項目が展開される

## 期待される出力

### req_index.json（要件レベル）

```json
{
  "version": "1.0.0",
  "description": "Requirement level traceability IDs",
  "level": "req",
  "traceability": [
    {
      "id": {
        "full": "req:api:deepresearch-3f8d2a#20250909",
        "level": "req",
        "scope": "api",
        "semantic": "deepresearch",
        "hash": "3f8d2a",
        "version": "20250909"
      },
      "summary": "DeepResearch API連携機能の要求定義",
      "description": "DeepResearchサービスをAPI経由で活用し、高度な情報収集・調査を実行する機能",
      "status": "draft",
      "tags": ["deep-research", "api-integration"],
      "derived_from": ["req:user:ai-settings-2c5e9b#20250906"],
      "trace_to": []
    }
    // ... 他の要件レベル項目
  ]
}
```

### spec_index.json（仕様レベル）

```json
{
  "version": "1.0.0",
  "description": "Specification level traceability IDs",
  "level": "spec",
  "traceability": [
    {
      "id": {
        "full": "spec:api:deepresearch-interface-5d7a2c#20250910",
        "level": "spec",
        "scope": "api",
        "semantic": "deepresearch-interface",
        "hash": "5d7a2c",
        "version": "20250910"
      },
      "summary": "DeepResearch APIインターフェース仕様",
      "description": "API連携のためのインターフェース定義",
      "status": "approved",
      "derived_from": ["req:api:deepresearch-3f8d2a#20250909"],
      "trace_to": ["design:api:deepresearch-client-8e3b4f#20250911"]
    }
    // ... 他の仕様レベル項目
  ]
}
```

## 成功指標

### 数値基準

- **ドキュメント数**: 7個のMarkdownファイルが処理される
- **レベル数**: 5種類（req, spec, design, impl, test）
- **トレーサビリティ項目数**: 各レベルで適切な数の項目が抽出される

### フィルタリングの正確性

- 各インデックスファイルに該当レベルの項目のみが含まれる
- JMESPathフィルタが正しく適用される
- レベル間の参照（derived_from, trace_to）が保持される

### トレーサビリティの完全性

- 全てのトレーサビリティIDが適切なレベルのインデックスに含まれる
- IDの構造（full, level, scope, semantic, hash, version）が保持される
- 関連情報（tags, status, derived_from等）が正しく抽出される

## 実行コマンド

```bash
# プロジェクトルートから（全レベル処理）
bash examples/3.docs/run.sh

# 個別レベルの処理
./cli.ts \
  examples/3.docs/index_req_schema.json \
  "examples/3.docs/docs/**/*.md" \
  examples/3.docs/index/req_index.json
```

## この例が実証すること

- 複雑なトレーサビリティ構造の管理
- x-flatten-arraysによるネスト配列の処理
- x-jmespath-filterによる動的フィルタリング
- レベル別のインデックス生成
- ソフトウェア開発ライフサイクル全体の文書管理
