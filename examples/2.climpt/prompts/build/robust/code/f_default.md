---
c1: build
c2: robust
c3: code
title: Robust Code Construction
description: Constructs robust and resilient code/API based on domain-driven design and totality principles.
usage: climpt-build robust code -f requirements.md -i=additional_instructions -o code_output/
options:
  file: true
  stdin: true
  destination: true
---

# API 強固構築

ドメイン駆動設計と全域性（Totality）原則に基づいた、強固で堅牢なAPI構築を行う。

## 強固構築方針

- **ドメイン駆動設計**: ビジネスロジックとドメインモデルを中核とした堅牢な設計
- **全域性原則**:
  型安全性による不正状態の完全排除（`docs/development/totality_go.ja.md`参照）
- **強固性重視**: 障害耐性、保守性、拡張性を重視した堅牢な構築
- [AI複雑化防止（科学的制御）](docs/development/ai-complexity-control_compact.ja.md)

## 必須参照資料

必ず以下の資料を参照してから強固な設計・実装を開始すること：

1. **ドメイン設計**: `docs/domain/design_domain_boundary-*.md`
2. **サブドメイン設計**: `docs/domain/architecture/**/*.md`
3. **全域性原則**: `docs/development/totality_go.ja.md`
4. **プロジェクト構造**: `docs/architecture/domain-driven-implementation.md`
5. **テスト方針**: `docs/tests/README.md`, `docs/tests/testing_guidelines.md`

## 強固構築手順

2. **ブランチ準備**
   ```bash
   echo "強固なAPI構築-{input_text_file}対応" | climpt-git decide-branch working-branc
   ```

3. **仕様理解・調査**
   - `{input_text_file}` の内容分析と強固性要件の特定
   - 既存実装の調査（`cmd/api-server/`, `api/openapi.yaml`）
   - ドメイン設計資料の読み込み

### Phase 2: 強固設計・計画

4. **強固ドメイン設計**
   - 対象機能のドメインモデル定義（障害耐性重視）
   - 全域性原則に基づく型安全設計
   - バリデーション・制約型の堅牢設計

5. **強固API設計**
   - OpenAPI仕様の作成・更新（エラーケース網羅）
   - エンドポイント設計（冪等性・一貫性重視）
   - リクエスト/レスポンス型定義（型安全性徹底）

6. **強固実装計画**
   - 修正対象ファイルのリスト化
   - 依存関係の整理（循環依存排除）
   - タスク分割とワーカー割り当て

### Phase 3: 強固実装

7. **コア強固実装**
   - ドメインモデルの堅牢実装（不変性保証）
   - リポジトリパターンの実装（トランザクション安全）
   - サービス層の実装（ビジネスルール遵守）
   - APIハンドラーの実装（エラー処理徹底）

8. **型安全性強化**
   - 制約型の実装（`NewValidType(input) (*Type, error)`パターン）
   - エラーハンドリングの統一（ValidationError使用）
   - 状態変換の全域化（不正状態完全排除）

### Phase 4: 徹底テスト・検証

9. **強固テスト実装**
   - ユニットテストの作成・修正（境界値・異常系網羅）
   - 統合テストの作成・修正（実運用環境模擬）
   - API仕様テストの実行（契約保証）

10. **品質検証**
    ```bash
    # 個別パッケージテスト
    go test ./path/to/package -v

    # 全ユニットテスト
    make test-unit

    # 全テスト
    make test
    ```

### Phase 5: 堅牢ドキュメント化

11. **API仕様書作成**
    - `docs/api/README.md` - API全体概要（強固性ポリシー含む）
    - `docs/api/endpoints/*.md` - 個別エンドポイント仕様（エラーケース網羅）
    - `docs/api/features/*.md` - 機能グループ仕様（障害対応含む）

12. **実装ドキュメント更新**
    - ドメインモデル図の更新（制約・不変条件明記）
    - アーキテクチャ図の更新（障害伝播経路含む）

13. コミット

- 最後に `climpt-git group-commit unstaged-changes`
  を実行し、表示された指示に従ってください。

## 強固構築内容

`{input_text_file}`の内容に基づいて以下を強固に構築する：

### 必須成果物

- [ ] ドメインモデル強固実装（全域性原則適用・不変条件保証）
- [ ] APIエンドポイント強固実装（障害耐性・冪等性保証）
- [ ] OpenAPI仕様更新（エラーケース網羅・契約保証）
- [ ] テストコード（ユニット・統合・境界値・異常系）
- [ ] API仕様書一式（強固性ポリシー含む）
- [ ] 実装ドキュメント（制約・障害対応含む）

### 強固性基準

- **型安全性**: 全域性原則による不正状態完全排除
- **障害耐性**: 異常系処理の徹底実装
- **テストカバレッジ**: `deno task ci` エラー0件
- **可読性**: ドメイン駆動設計による明確な責務分離
- **保守性**: 制約型とエラーハンドリングの統一
- **拡張性**: 変更に強い設計の採用

## 追加指示

{input_text}

## 完了条件

1. **強固実装完了**
   - `{input_text_file}` の要件を満たす強固なAPI実装完了
   - ドメイン駆動設計と全域性原則に基づく型安全で障害耐性の高い実装

2. **品質確保**
   - `deno task ci` がエラー0件で通過
   - 全ユニットテスト・統合テスト・異常系テストが成功
   - 境界値テスト・ストレステストの実施

3. **ドキュメント完備**
   - API仕様書一式の作成完了（強固性ポリシー含む）
   - 実装ドキュメントの更新完了（制約・障害対応含む）

## 強固構築開始指示

プロジェクトの成功と長期安定運用を目指し、強固な構築を開始してください。
