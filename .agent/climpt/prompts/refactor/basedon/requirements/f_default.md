---
c1: refactor
c2: basedon
c3: requirements
title: 要求に基づくリファクタリング
description: 現在の実装を要求に基づいて、要求実現に必要なリファクタリングをする
usage: climpt-refactor basedon requirement
options:
  input: ["default"]
  adaptation: ["default"]
  file: [false]
  stdin: [false]
  destination: [false]
---

# プロジェクト: 要求事項の実装

実装方針: `docs/requirements.ja.md`
に定義された要求事項を完全に満たす実装を行う。フロントマター解析、Schema処理、テンプレート変数置換の3つのコア機能を、ドメイン駆動設計と全域性（Totality）に基づいて実装する。

## 重要な参照資料

### 必須資料

- **要求定義**: `docs/requirements.ja.md` - 実装すべき機能要件の完全な定義
- **処理アーキテクチャ**:
  `docs/architecture/schema_process_architecture.ja.md` - Schema処理の詳細設計
- **Totality原則**: `docs/development/totality.ja.md` - 型安全性と完全性の確保
- **ドメイン境界**: `docs/domain/domain_boundary.md` - ドメイン領域の明確な定義
- **プロジェクト構造**: `docs/domain/architecture.md` - システムアーキテクチャ

### 設計原則

- AI実装複雑化防止: `docs/development/ai-complexity-control_compact.ja.md` -
  エントロピー増大の抑制
- ハードコーディング禁止: `docs/development/prohibit-hardcoding.ja.md` -
  柔軟性の確保
- テスト戦略: `docs/testing.md` - テスト実装の指針

## 重要な要求仕様

1. **フロントマター処理**:
   Markdownファイルからフロントマターを抽出し、TypeScriptで解析
2. **Schema構造化**: Schemaに基づく柔軟な構造化処理（変数名の名寄せ）
3. **テンプレート出力**: 解析結果をテンプレートフォーマットへ当て込み、出力
4. **特殊属性の処理**:
   - `x-template`: テンプレートファイル指定
   - `x-frontmatter-part`: 配列処理の判定
   - `x-derived-from`: 値の集約
   - `x-derived-unique`: ユニーク化

## 実施内容

### フェーズ1: 要求分析と設計

1. `docs/requirements.ja.md` を詳細に分析し、以下を明確化する
   - フロントマター解析の要求仕様
   - Schema定義による柔軟な構造化処理の要件
   - テンプレート変数置換の仕様
   - 集約機能(x-derived-from)の実装要件
2. `docs/architecture/schema_process_architecture.ja.md`
   を読み、処理アーキテクチャを理解する
3. `docs/domain/domain_boundary.md` と `docs/domain/architecture.md`
   でドメイン境界を把握する
4. 理解した内容を `tmp/<branch_name>/requirements_analysis.md` に文書化する

### フェーズ2: 現状分析と差分把握

1. 現在の実装を調査し、要求事項との差分を特定する
   - フロントマター解析機能の実装状況
   - Schema処理とテンプレート処理の実装状況
   - x-frontmatter-part、x-derived-from、x-template等の特殊属性の対応状況
2. 修正が必要なファイルを `tmp/<branch_name>/implementation_gap.md`
   にリスト化する
3. 各実装の修正優先度と依存関係を整理する

### フェーズ3: コア機能の実装

1. **フロントマター処理パイプライン**の実装
   - Markdownファイル一覧の取得（成果A）
   - フロントマター抽出（成果B）
   - TypeScriptによる解析（成果C）
   - Schema構造データへの変換（成果D）
   - テンプレート変数への当て込み（成果E）
   - 最終成果物の統合（成果Z）

2. **Schema処理エンジン**の実装
   - $ref参照の再帰的解決
   - x-template属性によるテンプレート指定
   - x-frontmatter-part属性による配列処理
   - x-derived-from属性による集約処理
   - x-derived-unique属性によるユニーク化

3. **テンプレート処理エンジン**の実装
   - {variable.path}形式の変数置換
   - {@items}形式の配列展開
   - テンプレートファイルの読み込みと適用

### フェーズ4: 実例による検証

1. 実例1（climptレジストリ）の実装
   - `.agent/test-climpt/prompts` のフロントマター解析
   - registry_schema.json/registry_template.jsonによる処理
   - `.agent/test-climpt/registry.json` への出力

2. 実例2（記事索引）の実装サンプル作成
  `.agent/articles` 配下の docs から記事の公開状態を一覧化する

3. 実例3（spec-trace）の実装
   - `.agent/spec-trace/docs` 配下のMarkdownファイル解析
   - 各カテゴリ別の索引生成
   - 成功イメージとして以下のファイルを生成:
     - `.agent/spec-trace/index/success_design_index_correct.json`
     - `.agent/spec-trace/index/success_impl_index_correct.json`
     - `.agent/spec-trace/index/success_req_index_correct.json`
     - `.agent/spec-trace/index/success_spec_index_correct.json`
     - `.agent/spec-trace/index/success_test_index_correct.json`

4. `examples/` 配下に実行可能な形で配置

### フェーズ5: テスト実装

1. 各機能のユニットテストを作成
   - フロントマター抽出のテスト
   - Schema処理のテスト（$ref解決、特殊属性処理）
   - テンプレート変数置換のテスト
   - 統合パイプラインのテスト
2. `deno test <test_file>` で各テストの動作確認
3. `deno test --allow-run --allow-env --allow-net --allow-read --allow-write src/`
   で全ユニットテスト実行
4. `deno task ci:dirty` で全テストの合格を確認

## 完了条件

1. `docs/requirements.ja.md` に記載された全要求事項が実装されている
   - フロントマターの抽出と解析機能
   - Schema定義による構造化処理（変数名の名寄せ）
   - テンプレートフォーマットへの当て込みと出力
   - 柔軟性の確保（Schemaとテンプレートの差し替え対応）
2. 特殊属性（x-template、x-frontmatter-part、x-derived-from等）が正しく処理される
3. 実例1（test-climptレジストリ）、実例2（記事索引）、実例3（spec-trace）が正常に動作する
4. spec-traceの5つの索引ファイルが正しく生成される
5. `deno task ci:dirty` がエラー0件で通過する

# タスクの進め方

- Gitブランチ準備:
  `echo "<今回の作業内容を30文字以内で表現>" | climpt-launch git-branch if-needed`
  を実行し、出力結果の指示に従う。
- サイクル: 仕様把握 → 調査 → 計画・設計 → 実行 → 記録・検証 → 学習 →
  仕様把握へ戻る
- 作業分担:
  作業内容をワーカープールマネージャーへ依頼し、ワーカーへの指示を行わせる。チームの常時フル稼働を目指す。

## 進捗更新

- 進捗させるべきタスクは `tmp/<branch_name>/tasks.md`
  に書き出し、完了マークをつけたりしながら進めてください。
- すべてが完了したら、`tmp/<branch_name>/completed.md`
  に完了したレポートを記録してください。

# 作業開始指示

## 最初に実施すること

1. **要求仕様の完全な理解**
   - `docs/requirements.ja.md` を熟読し、全体の処理フローを把握
   - 成果A〜成果Zまでの処理パイプラインを理解
   - 実例1（climptレジストリ）と実例2（記事索引）の仕様を確認

2. **現状分析**
   - 既存実装の調査（フロントマター処理、Schema処理、テンプレート処理）
   - 特殊属性（x-template、x-frontmatter-part、x-derived-from）の実装状況確認
   - 要求事項との差分を明確化

3. **実装計画の策定**
   - フェーズごとの実装タスクを `tmp/<branch_name>/tasks.md` に記載
   - 優先度と依存関係を整理
   - テスト戦略の立案

## 実装の優先順位

1. **コア機能**: フロントマター抽出とSchema処理
2. **特殊属性**: x-template、x-frontmatter-part、x-derived-from の実装
3. **テンプレート処理**: 変数置換と配列展開
4. **実例検証**: climptレジストリと記事索引の動作確認
5. **テスト充実**: カバレッジ80%以上の維持

## 成功の鍵

- **要求事項の厳密な実装**: `docs/requirements.ja.md` の仕様を完全に満たす
- **柔軟性の確保**: Schemaとテンプレートの差し替えによる汎用性
- **Totality原則**: 型安全性と完全性の徹底
- **テスト駆動**: 機能実装と同時にテストを作成

作業を開始してください。要求事項の実現に向けて、着実に進めましょう。
