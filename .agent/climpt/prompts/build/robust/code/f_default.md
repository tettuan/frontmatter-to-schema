---
c1: build
c2: robust
c3: code
title: GitHub Issue機能の堅牢実装
description: GitHub Issueから選択して機能要件を堅牢に実装する
usage: |
  GitHub Issueリストから選択して堅牢な機能実装を行います
  例: climpt-build robust code
options:
  input:
    - issue_selection
  adaptation:
    - default
    - detailed
  file: false
  stdin: false
  destination: false
---

# GitHub Issue 機能開発

GitHub Issueリストから選択した機能要件に基づき、DDD・TDD・Totality原則を適用した堅牢な実装を行う。

## 開発方針

- **ドメイン駆動設計**: ビジネスロジックとドメインモデルを中核とした設計
- **テスト駆動開発**: テストファーストによる品質保証
- **全域性原則**: 型安全性による不正状態の完全排除
- **AI複雑化防止**: 科学的制御による複雑性管理

## 必須参照資料

開発開始前に以下の資料を必ず確認すること：

1. **開発原則**
   - `docs/development/totality.ja.md` - 全域性原則
   - `docs/development/ai-complexity-control_compact.ja.md` - AI複雑化防止
   - `docs/development/prohibit-hardcoding.ja.md` - ハードコーディング禁止

2. **アーキテクチャ**
   - `docs/architecture/README.md` - アーキテクチャ概要
   - `docs/architecture/template-schema-domain-handoff.md` - ドメイン境界設計
   - `docs/architecture/template-output-subdomain-separation.md` - サブドメイン分離

3. **テスト戦略**
   - `docs/tests/README.md` - テスト戦略概要
   - `docs/tests/checklist-based-on-gh-issue.md` - Issueベースのチェックリスト
   - `docs/testing.ja.md` - テスト実装ガイド

## 実装フロー

### Phase 1: Issue選択と分析

1. **Issue選択**
   ```bash
   # オープンなIssueをリスト表示
   gh issue list --state open --limit 20

   # ラベルでフィルタリング（例：enhancement）
   gh issue list --label "enhancement" --state open

   # 特定のIssueの詳細を確認
   gh issue view {issue_number}
   ```

2. **Issue分析**
   - 選択したIssueの要件確認
   - 機能スコープの明確化
   - 受け入れ条件の定義

3. **既存実装調査**
   ```bash
   # 関連コードの検索
   deno task search --pattern "関連キーワード"

   # 既存テストの確認
   deno test --filter "関連テスト"
   ```

### Phase 2: 設計

4. **ドメインモデル設計**
   - エンティティ・値オブジェクトの定義
   - ビジネスルールの明確化
   - 境界づけられたコンテキストの設計

5. **テスト設計**
   - テストケースの洗い出し
   - 境界値・異常系の定義
   - E2Eシナリオの設計

### Phase 3: 実装

6. **TDD実装サイクル**
   ```bash
   # Red: テスト作成
   deno test --filter "新機能" --watch

   # Green: 実装
   # 最小限の実装でテストを通す

   # Refactor: リファクタリング
   # 設計パターンの適用
   ```

7. **ドメイン層実装**
   - モデル実装（値オブジェクト・エンティティ）
   - ドメインサービス実装
   - リポジトリインターフェース定義

8. **アプリケーション層実装**
   - ユースケース実装
   - DTOの定義
   - バリデーション実装

### Phase 4: 品質保証

9. **テスト実行**
   ```bash
   # 単体テスト
   deno test

   # カバレッジ確認（80%以上必須）
   deno task test:coverage

   # CI パイプライン
   deno task ci
   ```

10. **ドキュメント作成**
   - 実装仕様書の作成
   - APIドキュメント更新（該当する場合）
   - テスト仕様書の更新

### Phase 5: 完了

11. **プルリクエスト準備**
    ```bash
    # コミット作成
    gh issue develop {issue_number} --commit

    # PR作成
    gh pr create --title "feat: #{issue_number} 機能実装" \
                 --body "Closes #{issue_number}"
    ```

## 実装内容

選択したGitHub Issueに基づく以下の実装：

### 成果物チェックリスト

- [ ] ドメインモデル実装（Totality原則適用）
- [ ] ユースケース実装（ビジネスルール遵守）
- [ ] テストコード（単体・統合・E2E）
- [ ] カバレッジ80%以上達成
- [ ] ドキュメント更新
- [ ] CI パイプライン通過

### 品質基準

- **型安全性**: 全域性原則による不正状態排除
- **テストカバレッジ**: 80%以上維持
- **コード品質**: `deno lint` エラー0件
- **保守性**: DDD原則に基づく責務分離
- **可読性**: 明確な命名とドキュメント

## 追加指示

{issue_selection}

## 完了条件

1. **機能実装完了**
   - GitHub Issue の要件を全て満たす
   - 受け入れテスト通過

2. **品質確保**
   - `deno task ci` エラー0件
   - テストカバレッジ80%以上
   - コードレビュー承認

3. **ドキュメント完備**
   - 実装仕様書作成完了
   - テスト仕様書更新完了

## 実装開始

上記フローに従い、品質を重視した機能実装を開始してください。
