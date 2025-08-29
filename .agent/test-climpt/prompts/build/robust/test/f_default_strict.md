---
c1: build
c2: robust
c3: test
title: Robust and Resilient Test Construction Guide
description: Comprehensive guide for constructing robust, change-resilient, and maintainable test code with business logic quality assurance.
usage: climpt-build robust test -a=strict -f specification.md -i=additional_requirements -o test_output/
options:
  adaptation: ["strict"]
  file: [true]
  stdin: [true]
  destination: [true]
---

# 強固で堅牢なテスト構築指示書

## 0. 目的・適用範囲

### 目的

変更に強く、再現性が高く、保守性に優れたテストコードを構築し、ビジネスロジックの品質を確実に保証する。

### 適用範囲

- ユニットテスト、統合テスト、E2Eテストの新規作成・改善
- 既存テストのリファクタリング・強化
- テストインフラストラクチャの構築・改善

### 非適用範囲

- パフォーマンステストの詳細実装
- セキュリティ監査テスト
- 負荷テスト・ストレステスト

## 1. 不変条件（壊してはならない性質）

1. **再現性100%**: 同一入力で常に同一結果を保証
2. **冪等性保証**: 何度実行しても同じ結果・副作用なし
3. **分離性確保**: テスト間の依存関係ゼロ・並列実行安全
4. **環境独立性**: 実行環境差分の影響を受けない
5. **最小依存原則**: 外部依存を最小化し、モック・スタブで制御

## 2. 前提条件・入力

### 入力

- `{input_text_file}`: テスト対象機能の仕様書
- `{input_text}`: 追加要件・特別考慮事項
- `{uv-test-scope}`: テスト範囲指定

### 前提情報リスト

- プロジェクトはGo言語で実装されている
- ドメイン駆動設計に基づいた構造を持つ
- CI/CDパイプラインとの統合が必要
- テストカバレッジ80%以上が目標

### 禁止事項

- グローバル状態の利用
- 外部サービスへの直接アクセス（モック必須）
- テスト間での共有リソース利用
- ハードコードされた待機時間

## 3. 変数・可変コマンドの挿入判断

### 3.1 ブランチ作成指示

構築・リファクタリング作業の場合、以下を手順の最初に実行：

```
- Gitブランチ準備: `echo "強固テスト構築-{uv-test-scope}" | climpt-git decide-branch working-branc` を実行し、出力結果の指示に従う。
```

## 4. 強固テスト構築手順

### Phase 1: 事前情報収集・分析

#### 4.1 既存テスト環境調査

1. **現状把握**
   - `tests/`ディレクトリ構造の調査
   - `internal/*/test.go`の既存実装パターン分析
   - テストヘルパー・ユーティリティの確認

2. **仕様理解**
   - `{input_text_file}`の詳細分析
   - ドメイン境界の特定（`docs/domain/design_domain_boundary-*.md`）
   - テストスコープの明確化

3. **依存関係分析**
   - 外部依存の洗い出し
   - モック化必要箇所の特定
   - テストデータ要件の確認

### Phase 2: 強固設計・計画

#### 4.2 テスト戦略設計

1. **テストピラミッド設計**
   ```
   E2E Tests        △     (10%)
   Integration    ▢▢▢    (30%)  
   Unit Tests   ▢▢▢▢▢▢   (60%)
   ```

2. **コアテスト特定**
   - ビジネスクリティカルな機能の優先順位付け
   - 変更頻度の高い部分の重点テスト
   - エッジケースとハッピーパスの分離

3. **テストダブル戦略**
   - Mock: 振る舞い検証が必要な場合
   - Stub: 固定値返却で十分な場合
   - Fake: 簡易実装で代替可能な場合

#### 4.3 テストインフラ設計

1. **テストヘルパー設計**
   ```go
   // 統一的なテストヘルパー構造
   type TestHelper struct {
       T        *testing.T
       DB       *TestDB
       Fixtures *FixtureManager
       Cleanup  func()
   }
   ```

2. **フィクスチャ管理**
   - テストデータの一元管理
   - セットアップ・ティアダウンの自動化
   - データの独立性保証

### Phase 3: 強固実装

#### 4.4 ユニットテスト実装

1. **AAA(Arrange-Act-Assert)パターン厳守**
   ```go
   func TestDomainLogic_CoreBehavior(t *testing.T) {
       // Arrange: 準備
       sut := NewSystemUnderTest()
       input := CreateTestInput()
       
       // Act: 実行
       result, err := sut.Execute(input)
       
       // Assert: 検証
       assert.NoError(t, err)
       assert.Equal(t, expected, result)
   }
   ```

2. **テーブル駆動テスト活用**
   ```go
   tests := []struct {
       name     string
       input    Input
       expected Output
       wantErr  bool
   }{
       // テストケース定義
   }
   ```

#### 4.5 統合テスト実装

1. **境界テスト重視**
   - API境界の検証
   - データベース境界の検証
   - 外部サービス境界の検証

2. **トランザクション管理**
   - テストごとのトランザクション分離
   - ロールバック保証
   - 並列実行対応

### Phase 4: 品質検証

#### 4.6 テスト品質メトリクス

1. **カバレッジ測定**
   ```bash
   make test-coverage
   # 目標: 80%以上
   # コア機能: 95%以上
   ```

2. **実行時間監視**
   - ユニットテスト: < 10秒
   - 統合テスト: < 60秒
   - E2Eテスト: < 5分

3. **フレーキーテスト検出**
   ```bash
   # 10回連続実行で安定性確認
   for i in {1..10}; do make test || break; done
   ```

### Phase 5: ドキュメント化・統合

#### 4.7 テストドキュメント作成

1. **テスト仕様書**
   - `docs/tests/{uv-test-scope}/test-specification.md`
   - テスト観点・カバレッジマトリクス
   - 実行手順・環境設定

2. **CI/CD統合**
   ```yaml
   # .github/workflows/test.yml
   - name: Run Unit Tests
     run: make test-unit
   - name: Run Integration Tests
     run: make test-integration
   - name: Check Coverage
     run: make test-coverage-check
   ```

## 5. 品質基準・完了条件

### 品質基準

- **S.O.L.I.D原則準拠**: 単一責任・依存性逆転
- **F.I.R.S.T原則準拠**: Fast, Independent, Repeatable, Self-validating, Timely
- **変更耐性**: リファクタリング時のテスト修正最小化

### 完了条件

1. ✅ `{input_text_file}`の全要件をテストでカバー
2. ✅ カバレッジ80%以上達成（コア機能95%以上）
3. ✅ 全テストが10回連続成功（フレーキーテストなし）
4. ✅ CI/CDパイプライン統合完了
5. ✅ テストドキュメント完備

## 6. 必須参照資料

### コード変更用必須資料

- **全域性原則**: `docs/development/totality_go.ja.md`
- **AI複雑化防止**: `docs/development/ai-complexity-control_compact.ja.md`

### テスト設計資料

- **テスト方針**: `docs/tests/README.md`, `docs/tests/testing_guidelines.md`
- **ドメイン設計**: `docs/domain/design_domain_boundary-*.md`
- **アーキテクチャ**: `docs/architecture/domain-driven-implementation.md`

### 実装参考資料

- **既存テスト**: `tests/`, `internal/*/test.go`
- **テストヘルパー**: `internal/testutil/`, `tests/helpers/`

## 7. 作業開始コマンド

```bash
# 1. ブランチ準備
echo "強固テスト構築-{uv-test-scope}" | climpt-git decide-branch working-branc

# 2. 既存テスト確認
find tests -name "*.go" | head -20
grep -r "func Test" internal --include="*_test.go" | head -20

# 3. カバレッジ現状確認
make test-coverage

# 4. 作業開始
# タスクリスト作成 → 実装 → 検証のサイクル開始
```

## 8. 追加指示

{input_text}

---

**開始指示**:

1. まず、`{input_text_file}`の内容を分析し、テスト対象を明確化する
2. 既存テストコードを調査し、プロジェクトのテストパターンを理解する
3. 強固性基準を満たすテスト設計を作成する
4. 段階的に実装し、各段階で品質を検証する
5. 最終的に全品質基準を満たすことを確認する

変更に強く、保守性の高い、真に堅牢なテストの構築を開始してください。
