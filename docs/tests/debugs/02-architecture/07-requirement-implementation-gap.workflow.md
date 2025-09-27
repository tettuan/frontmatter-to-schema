---
# XML変換メタデータ
workflow:
  id: "requirement-implementation-gap-analysis"
  type: "architecture-debug"
  scope: "system-wide"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-requirement-gap-{timestamp}.log"
  - evidence: "tmp/evidence-requirement-gap.json"
---

# 要求と実装の乖離分析デバッグワークフロー

## 目的

プロジェクトの要求仕様と実際の実装の間の致命的な乖離を特定し、DDD/TDD/Totality原則違反を検証する。

## 前提条件

- [ ] 要求仕様書が存在する（docs/requirements.ja.md）
- [ ] テスト環境が設定済み
- [ ] BreakdownLoggerが利用可能
- [ ] GitHub Issue #1080, #1093が確認済み

## 入力

- **対象**: プロジェクト全体のアーキテクチャと実装
- **症状**: 要求充足度20%、テスト失敗7個、processFrontmatterParts未実装
- **コンテキスト**: DDD/TDD原則違反、132個のif文、2285行の巨大サービス

## ワークフロー手順

### ステップ1: 要求仕様の確認

{xml:step id="step1" type="verification"}

1. 要求仕様書の読み込み
   ```bash
   cat docs/requirements.ja.md | head -50
   ```
2. 核心要求の抽出
   - 柔軟性確保（ハードコーディング禁止）
   - Schema駆動設計
   - x-*ディレクティブによる制御
3. 24実行例の確認
   ```bash
   grep -n "実例" docs/requirements.ja.md
   ```

{/xml:step}

### ステップ2: 実装状況の調査

{xml:step id="step2" type="investigation"}

1. 環境変数設定
   ```bash
   export LOG_KEY=requirement-gap LOG_LEVEL=debug LOG_LENGTH=L
   ```

2. 巨大サービスファイルの分析
   ```bash
   wc -l src/domain/frontmatter/services/frontmatter-transformation-service.ts
   grep -n "if\|else" src/domain/frontmatter/services/frontmatter-transformation-service.ts | wc -l
   ```

3. 重複ファイルの検出
   ```bash
   ls -la src/domain/frontmatter/services/*-v*.ts
   ls -la src/domain/frontmatter/services/*-compact.ts
   ls -la src/domain/frontmatter/services/*-final.ts
   ```

4. processFrontmatterParts実装確認
   ```bash
   grep -r "processFrontmatterParts" src/ --include="*.ts"
   ```

{/xml:step}

### ステップ3: x-frontmatter-part処理の振れ幅分析

{xml:step id="step3" type="investigation"}

1. x-frontmatter-part使用箇所の特定
   ```bash
   grep -r "x-frontmatter-part" src/ --include="*.ts" | head -20
   ```

2. 統合タイミングの調査
   ```bash
   grep -A5 -B5 "x-frontmatter-part.*true" src/ --include="*.ts"
   ```

3. {@items}確定時期の特定
   ```bash
   grep -r "@items" src/ --include="*.ts"
   ```

{/xml:step}

### ステップ4: テスト仕様カバレッジ評価

{xml:step id="step4" type="diagnosis"}

1. 24実行例のテスト実装確認
   ```bash
   find tests -name "*_test.ts" -exec grep -l "describe.*24\|execution.*example" {} \;
   ```

2. テスト失敗の詳細取得
   ```bash
   LOG_KEY=test-failures LOG_LEVEL=debug deno test --allow-all tests/unit/domain/frontmatter/services/frontmatter-transformation-service_test.ts 2>&1 | grep -E "FAILED|error"
   ```

3. BreakdownLogger戦略の適用確認
   ```bash
   grep -r "BreakdownLogger" tests/ --include="*_test.ts" | wc -l
   ```

{/xml:step}

### ステップ5: DDD/TDD/Totality原則評価

{xml:step id="step5" type="diagnosis"}

1. 単一責任原則違反の測定
   ```bash
   # メソッド数カウント
   grep -n "^\s*public\|^\s*private\|^\s*protected" src/domain/frontmatter/services/frontmatter-transformation-service.ts | wc -l
   ```

2. ハードコーディング箇所の特定
   ```bash
   # 文字列直接参照
   grep -r '"x-frontmatter-part"' src/ --include="*.ts" | wc -l
   ```

3. if文による特殊解の計測
   ```bash
   # 各ファイルのif文数
   for file in src/domain/frontmatter/services/*.ts; do
     count=$(grep -o "\bif\s*(" "$file" | wc -l)
     echo "$file: $count"
   done | sort -t: -k2 -rn | head -10
   ```

{/xml:step}

### ステップ6: 解決策の実装

{xml:step id="step6" type="resolution"}

1. 即座対応スクリプトの実行
   ```bash
   # 重複ファイル削除（2331行削減）
   chmod +x /tmp/immediate-action-commands.sh
   ./tmp/immediate-action-commands.sh
   ```

2. processFrontmatterParts実装または削除
   ```bash
   # 実装箇所の特定
   grep -r "processFrontmatterParts" tests/ --include="*_test.ts"
   ```

3. テスト再実行による効果確認
   ```bash
   deno test --allow-all tests/unit/domain/frontmatter/services/
   ```

{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-requirement-gap-{timestamp}.log`
- **証跡データ**: `tmp/evidence-requirement-gap.json`
- **分析レポート**:
  - `/tmp/requirement-flow-analysis-2025-09-27.md`
  - `/tmp/ddd-tdd-comparison-analysis-2025-09-27.md`
  - `/tmp/final-investigation-report-2025-09-27.md`

## 成功基準

- [ ] 要求と実装の乖離箇所が全て特定されている
- [ ] 132個のif文の削減計画が立案されている
- [ ] processFrontmatterParts問題が解決されている
- [ ] 24実行例のテスト実装計画が作成されている

## 関連ワークフロー

- [FrontmatterTransformationServiceリファクタリング](./02-frontmatter-transformation-refactoring.workflow.md)
- [ハードコーディング違反分析](./05-hardcoding-violation-analysis.workflow.md)
- [未使用サービス統合分析](./06-unused-services-integration.workflow.md)

## トラブルシューティング

### 問題1: processFrontmatterParts未実装エラー

- **症状**: TypeError: _service.processFrontmatterParts is not a function
- **原因**: インターフェース定義と実装の不一致
- **解決策**:
  1. FrontmatterPartProcessorクラスにメソッド実装
  2. または、テストから該当呼び出しを削除

### 問題2: 巨大サービスファイルのリファクタリング困難

- **症状**: 2285行のファイルが分割できない
- **原因**: 責任の境界が不明確、相互依存が複雑
- **解決策**:
  1. 責任ごとに5つのサービスに分割
  2. 依存関係を明確化
  3. 段階的なリファクタリング

### 問題3: x-frontmatter-part統合タイミングの不確定性

- **症状**: {@items}の確定時期が予測不能
- **原因**: 処理フローの振れ幅
- **解決策**:
  1. 明確な3段階処理（個別→統合→展開）
  2. 統合タイミングの固定化
  3. デバッグログによる可視化
