---
# XML変換メタデータ
workflow:
  id: "layered-architecture-dependency-analysis"
  type: "architecture-violation"
  scope: "application-layer"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
  - inspector: "inspector-debug analyze-deep project-issues"
outputs:
  - debug_logs: "tmp/debug-layered-dependency-{timestamp}.log"
  - evidence: "tmp/evidence-layer-violations.json"
  - issue_tracking: "GitHub Issue #1070"
---

# Layered Architecture Dependency Violation Analysis Workflow

## 目的

ProcessingCoordinator(891行)で発見されたApplication→Infrastructure直接依存を起点として、プロジェクト全体のレイヤードアーキテクチャ違反を体系的に調査し、依存関係逆転原則に基づく修正戦略を策定する。

## 前提条件

- [ ] 条件1: Issue #1070 (レイヤードアーキテクチャ違反) が作成済み
- [ ] 条件2: inspector-debug analyze-deep project-issuesが実行可能
- [ ] 条件3: 398テスト通過状態を維持
- [ ] 条件4: DDD原則・レイヤー分離の理解

## 入力

- **対象**: `src/application/coordinators/processing-coordinator.ts` (891行)
- **症状**: Application層からInfrastructure層への直接依存
- **コンテキスト**: Line 15 `DebugLogger` import による設計原則違反

## ワークフロー手順

### ステップ1: ProcessingCoordinator 依存関係詳細分析

{xml:step id="step1" type="verification"}

1. 問題の依存関係確認
   ```bash
   export LOG_KEY=layer-dependency-analysis LOG_LEVEL=debug
   grep -n "import.*infrastructure" src/application/coordinators/processing-coordinator.ts
   ```

2. 使用箇所の特定
   ```bash
   grep -n -A3 -B3 "DebugLogger" src/application/coordinators/processing-coordinator.ts
   ```

3. 依存関係の影響範囲
   ```bash
   # ProcessingCoordinator の依存関係すべて確認
   grep -n "import" src/application/coordinators/processing-coordinator.ts
   ```

期待される結果: DebugLogger直接依存の具体的箇所特定

{/xml:step}

### ステップ2: Application層全体の依存関係監査

{xml:step id="step2" type="investigation"}

1. Application層全体のInfrastructure依存検索
   ```bash
   export LOG_KEY=application-layer-audit LOG_LEVEL=info
   find src/application -name "*.ts" -type f -exec grep -l "import.*infrastructure" {} \;
   ```

2. 各ファイルの詳細依存関係
   ```bash
   for file in $(find src/application -name "*.ts" -type f); do
     echo "=== $file ==="
     grep "import.*infrastructure" "$file" || echo "No violations"
   done
   ```

3. 依存関係のパターン分析
   ```bash
   # 最も多い違反パターンを特定
   find src/application -name "*.ts" -exec grep "import.*infrastructure" {} \; | sort | uniq -c | sort -nr
   ```

{/xml:step}

### ステップ3: レイヤードアーキテクチャ原則との対比

{xml:step id="step3" type="diagnosis"}

1. DDD原則の確認
   ```bash
   grep -n -A5 -B5 "レイヤー\|Layer" docs/development/totality.ja.md
   ```

2. 24実行例パターンとの整合性
   - **例7-12 (Application Layer)**: 不適切な依存関係による実行制約
   - **例1-6 (Presentation Layer)**: 間接的影響の評価
   - **例19-24 (Infrastructure Layer)**: 逆方向依存の確認

3. 理想的なレイヤー構造の設計
   ```typescript
   // 期待される依存関係
   Application Layer → Domain Layer (OK)
   Application Layer → Infrastructure Layer (NG)
   Application Layer → Infrastructure Interfaces (OK)
   ```

{/xml:step}

### ステップ4: Dependency Inversion 修正戦略

{xml:step id="step4" type="diagnosis"}

1. インターフェース抽出戦略
   ```bash
   # 現在のDebugLogger使用パターン確認
   export LOG_KEY=debug-logger-usage LOG_LENGTH=W
   grep -r -A2 -B2 "DebugLogger" src/application/
   ```

2. 修正アプローチの設計
   - **Option A**: DebugLoggerインターフェースをDomain層に配置
   - **Option B**: Application層独自のLoggerインターフェース定義
   - **Option C**: Dependency Injection コンテナによる疎結合化

3. 既存テストへの影響評価
   ```bash
   find tests -name "*processing-coordinator*test.ts" -exec grep -l "DebugLogger" {} \;
   ```

{/xml:step}

### ステップ5: 修正実装とアーキテクチャ整合性検証

{xml:step id="step5" type="resolution"}

1. 修正方針の決定と記録
   ```bash
   # 選択した修正アプローチの記録
   echo "$(date): Selected approach for DI violation fix" >> tmp/architecture-fix-log.txt
   ```

2. 他のApplication層ファイルへの適用計画
   ```bash
   # 同様の問題があるファイルのリスト作成
   find src/application -name "*.ts" -type f -exec grep -l "import.*infrastructure" {} \; > tmp/layer-violation-files.txt
   ```

3. Issue更新と完了基準の明確化
   ```bash
   gh issue comment 1070 --body "## レイヤー依存関係監査完了

   **調査ファイル数**: $(find src/application -name '*.ts' | wc -l)
   **違反ファイル数**: $(find src/application -name '*.ts' -exec grep -l 'import.*infrastructure' {} \; | wc -l)

   **修正戦略**: Dependency Injection パターンによる疎結合化
   **次段階**: インターフェース抽出・実装開始"
   ```

{/xml:step}

## 出力

- **違反ファイルリスト**: `tmp/layer-violation-files.txt`
- **修正戦略ドキュメント**: 段階的修正アプローチ
- **アーキテクチャ整合性レポート**: `tmp/evidence-layer-violations.json`

## 成功基準

- [ ] Application層全体の依存関係違反が完全に特定されている
- [ ] 24実行例パターンへの影響が評価されている
- [ ] Dependency Inversionに基づく修正戦略が策定されている
- [ ] Issue #1070に具体的な修正計画が記載されている

## 関連ワークフロー

- [Totality Verification](./01-totality-verification.workflow.md)
- [Frontmatter Refactoring](./02-frontmatter-transformation-refactoring.workflow.md)
- [Template Variable Analysis](../component/template-variable-defaults.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: レイヤー境界の曖昧性

- **症状**: Application層とDomain層の境界が不明確
- **原因**: 責任分離の不適切な実装
- **解決策**: DDD境界線の明確な定義、Bounded Context設計

#### 問題2: Dependency Injection の複雑性

- **症状**: DIコンテナ導入による設計複雑化
- **原因**: 過度な抽象化・間接化
- **解決策**: Simple Factory Pattern、段階的DI導入

#### 問題3: 既存テストの破綻

- **症状**: 依存関係修正後のテスト失敗
- **原因**: 具象クラス依存のモック困難
- **解決策**: Test Double パターン、インターフェースベースモック
