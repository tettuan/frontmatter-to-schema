---
# XML変換メタデータ
workflow:
  id: "template-variable-defaults"
  type: "component-analysis"
  scope: "template-domain"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
  - inspector: "inspector-debug analyze-deep project-issues"
outputs:
  - debug_logs: "tmp/debug-template-variable-{timestamp}.log"
  - evidence: "tmp/evidence-template-analysis.json"
  - issue_tracking: "GitHub Issues #1068, #1067"
---

# Template Variable Defaults and x-template-items Implementation Analysis Workflow

## 目的

OutputRenderingService(943行)とTemplate関連サービスにおける`x-template-items`機能の未実装状況を調査し、要求仕様24パターンのうち約30%が実行不可能な問題の根本要因を特定する。

## 前提条件

- [ ] 条件1: Issue #1068 (x-template-items未実装) が作成済み
- [ ] 条件2: Issue #1067 (テスト設計不足) が作成済み
- [ ] 条件3: inspector-debug analyze-deep project-issuesが実行可能
- [ ] 条件4: 398テスト通過状態を維持

## 入力

- **対象**: `src/domain/template/services/output-rendering-service.ts` (943行)
- **症状**: x-template-items機能が完全未実装、{@items}展開処理なし
- **コンテキスト**: 要求仕様の核心機能が欠如し、24実行例の30%が不可能

## ワークフロー手順

### ステップ1: Template Domain 実装状況調査

{xml:step id="step1" type="verification"}

1. Template関連ファイル構造確認
   ```bash
   find src/domain/template -name "*.ts" -type f | head -10
   ```

2. x-template-items関連実装検索
   ```bash
   export LOG_KEY=template-items-search LOG_LEVEL=debug
   grep -r "x-template-items" src/domain/template/
   ```

3. {@items}展開機能検索
   ```bash
   grep -r "@items" src/domain/template/
   ```

期待される結果: 両方とも0件のヒット（未実装確認）

{/xml:step}

### ステップ2: OutputRenderingService 詳細分析

{xml:step id="step2" type="investigation"}

1. サービス構造の把握
   ```bash
   export LOG_KEY=output-rendering-analysis LOG_LEVEL=info
   mcp-serena get-symbols-overview src/domain/template/services/output-rendering-service.ts
   ```

2. ArrayData処理の現状確認
   ```bash
   grep -n -A5 -B5 "ArrayData" src/domain/template/services/output-rendering-service.ts
   ```

3. 配列処理ロジックの限界調査
   ```bash
   grep -n -A10 "itemsData" src/domain/template/services/output-rendering-service.ts
   ```

{/xml:step}

### ステップ3: 要求仕様との対応関係分析

{xml:step id="step3" type="diagnosis"}

1. 要求仕様の再確認
   ```bash
   grep -n -A5 -B5 "x-template-items" docs/requirements.ja.md
   ```

2. 24実行例との対応分析
   - 例17: x-template-items + {@items} → **実装不可能**
   - 例18: x-flatten-arrays + 多階層 → **部分実装のみ**
   - 例19: $ref + x-template → **$ref処理は実装済み**

3. 影響範囲の特定
   ```bash
   # テンプレート処理に関連する全ファイルを調査
   find src -name "*.ts" -type f -exec grep -l "template" {} \; | wc -l
   ```

{/xml:step}

### ステップ4: テンプレート処理アーキテクチャの評価

{xml:step id="step4" type="diagnosis"}

1. Template Domain境界の確認
   ```bash
   ls -la src/domain/template/
   ```

2. Schema-Template連携の現状
   ```bash
   grep -r "x-template" src/domain/schema/
   ```

3. 既存のテンプレート展開機能の限界
   ```bash
   export LOG_KEY=template-limitations LOG_LENGTH=W
   grep -n -A15 "renderOutput" src/domain/template/services/output-rendering-service.ts
   ```

{/xml:step}

### ステップ5: 実装戦略と課題の明確化

{xml:step id="step5" type="resolution"}

1. 必要な実装コンポーネントの特定
   - **TemplateItemsProcessor**: x-template-items処理専門
   - **ItemsExpansionEngine**: {@items}展開機能
   - **DynamicTemplateLoader**: 動的テンプレート読み込み

2. 既存アーキテクチャとの統合点分析
   ```bash
   # OutputRenderingServiceとの統合ポイント特定
   grep -n "interface\|class" src/domain/template/services/output-rendering-service.ts
   ```

3. Issue更新とワークフロー完了記録
   ```bash
   echo "$(date): Template analysis workflow completed" >> tmp/template-investigation.log
   ```

{/xml:step}

## 出力

- **分析結果**: `tmp/evidence-template-analysis.json`
- **実装差分**: 要求仕様と現実装のギャップマップ
- **実装戦略**: 段階的x-template-items実装計画

## 成功基準

- [ ] x-template-items機能の未実装状況が完全に把握されている
- [ ] 24実行例パターンの実行不可能項目が特定されている
- [ ] OutputRenderingServiceの改修ポイントが明確化されている
- [ ] Issue #1068への具体的な実装戦略が提示されている

## 関連ワークフロー

- [Architecture Analysis](../02-architecture/01-totality-verification.workflow.md)
- [Component Debugging](./directive-processor-comprehensive.workflow.md)
- [Integration Testing](../integration/x-flatten-arrays-debugging.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: Template処理の複雑性による実装困難

- **症状**: x-template-items実装時の既存機能への影響
- **原因**: OutputRenderingService(943行)の責任過多
- **解決策**: Template処理の段階的分離、專門Service分割

#### 問題2: Schema-Template境界の曖昧性

- **症状**: x-template-items情報の取得元不明確
- **原因**: Domain間の責任境界が不明確
- **解決策**: DDD原則に基づく明確な境界定義とハンドオフ機構

#### 問題3: 既存テストとの整合性

- **症状**: x-template-items実装後の既存テスト破綻
- **原因**: 仕様拡張に対するテスト設計の不足
- **解決策**: Specification-driven testアプローチでの段階的テスト拡張
