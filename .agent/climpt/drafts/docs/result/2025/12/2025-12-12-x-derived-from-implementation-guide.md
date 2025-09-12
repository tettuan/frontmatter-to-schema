---
title: "x-derived-from機能実装完了と運用ガイド"
version: "1.0"
created: "2025-12-12"
variables:
  - input_text: "実装された x-derived-from 機能の使用方法"
  - destination_path: "出力ファイルのPATH"
---

# x-derived-from機能実装完了と運用ガイド

## 概要

frontmatter-to-schema プロジェクトにおいて、要求仕様書（docs/requirements.ja.md）で定義されていた x-derived-from 機能が完全に実装され、Issue #673 が解決されました。本ガイドでは、実装された機能の仕様、使用方法、および技術的詳細を説明します。

## 前提情報リスト

- **プロジェクト目的**: Markdown FrontMatter から Schema に基づく構造化処理によるテンプレート出力
- **ドメイン**: DDD（Domain-Driven Design）に基づく設計
- **使用言語**: TypeScript（Deno環境）
- **主要アーキテクチャ**: Aggregation Context による Schema 拡張処理
- **テスト状況**: 622テスト全て成功、CI完全通過
- **ブランチ状態**: develop ブランチに統合済み、本番準備完了

## 仮定リスト

- Schema ファイルと Template ファイルは適切に定義されている
- x-frontmatter-part による配列判定が既に実装されている
- Deno環境が適切にセットアップされている

## 1. 実装された機能

### 1.1 Context Resolution Engine

**場所**: `src/domain/aggregation/aggregation-service.ts`

**機能**: スキーマ式の文脈解決
- `resolveExpressionContext()` メソッドがスキーマ表現を実際のデータ構造にマッピング
- `"commands[].c1"` → `"tools.commands[].c1"` への自動解決
- ネストされたデータ構造内での配列パス検索

**アルゴリズム**:
1. 直接式評価の試行
2. 失敗時のネスト構造探索
3. マッチするパスの自動特定

### 1.2 Nested Result Merging

**場所**: `src/application/use-cases/aggregate-results/aggregate-results.usecase.ts`

**機能**: ドット記法キーの階層化
- `mergeNestedResults()` メソッドがドット記法を適切なオブジェクト構造に変換
- `"tools.availableConfigs"` → `tools.availableConfigs` プロパティへの正確な配置
- 既存構造の保護と新規フィールドの適切な統合

### 1.3 統合された集約処理

**機能**: x-frontmatter-part と x-derived-from の完全連携
- 配列要素からの値抽出
- ユニーク化処理
- テンプレート変数への適切な配置

## 2. 使用方法

### 2.1 Schema定義例

```json
{
  "type": "object",
  "properties": {
    "tools": {
      "type": "object",
      "properties": {
        "availableConfigs": {
          "type": "array",
          "x-derived-from": "commands[].c1",
          "x-derived-unique": true,
          "items": { "type": "string" }
        },
        "commands": {
          "type": "array",
          "x-frontmatter-part": true,
          "items": {
            "type": "object",
            "properties": {
              "c1": { "type": "string" },
              "c2": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

### 2.2 期待される動作

**入力**: 複数のMarkdownファイル（各々 `c1`, `c2` フロントマターを含む）

**処理**:
1. x-frontmatter-part により commands 配列に各ファイルデータを集約
2. x-derived-from により commands[].c1 から availableConfigs を生成
3. x-derived-unique により重複除去

**出力**:
```json
{
  "tools": {
    "commands": [
      { "c1": "git", "c2": "merge-up" },
      { "c1": "debug", "c2": "analyze" }
    ],
    "availableConfigs": ["git", "debug"]
  }
}
```

## 3. 技術的品質保証

### 3.1 DDD原則適合

- Result<T,E> パターンの維持
- ドメイン境界の尊重
- Value Object と Entity の適切な使用

### 3.2 テスト品質

- **総テスト数**: 622テスト（1670ステップ）
- **成功率**: 100%
- **回帰検証**: 既存機能への影響なし
- **E2E検証**: 完全な処理フロー確認済み

### 3.3 CI/CD品質

- TypeScript コンパイル: ✅
- JSR互換性: ✅  
- Lint検査: ✅
- Format検査: ✅

## 4. 成果物

### 4.1 主成果物

- 完全に動作する x-derived-from 処理システム
- 既存システムとの完全互換性維持
- 汎用的なスキーマ処理パイプライン

### 4.2 付録

- **用語集**: x-frontmatter-part, x-derived-from, Context Resolution, Nested Result Merging
- **関連Issue**: #673（解決済み）, #672, #666, #663, #651
- **検証結果**: develop ブランチでの動作確認完了

## 5. 参照資料

- **要求仕様**: `docs/requirements.ja.md` - x-derived-from の仕様定義
- **全域性原則**: `docs/development/totality.ja.md` - Result<T,E> パターン設計指針
- **AI複雑化防止**: `docs/development/ai-complexity-control_compact.ja.md` - 科学的制御手法
- **DDD設計**: プロジェクト内ドメインモデル実装

## 6. 運用指針

### 6.1 新しいSchemaタイプ追加時

1. x-frontmatter-part による配列指定
2. x-derived-from による集約ルール定義
3. Context Resolution の自動適用確認
4. E2Eテストによる動作検証

### 6.2 トラブルシューティング

- **式解決失敗**: ログで Context Resolution の動作を確認
- **ネスト構造問題**: Nested Result Merging の処理過程を検証
- **集約結果異常**: x-derived-unique の適用状況を確認

## 7. Definition of Done

- [x] x-frontmatter-part判定ロジックの実装
- [x] 汎用的なSchema処理パイプラインの構築  
- [x] Registry処理の動作維持（622テスト成功）
- [x] E2Eテストの完了
- [x] 全不変条件の充足
- [x] 前提情報リストの網羅

---

**変更履歴**:
- v1.0: 初版作成（2025-12-12）