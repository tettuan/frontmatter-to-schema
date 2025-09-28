---
workflow:
  id: "test-coverage-improvement"
  type: "architecture"
  scope: "system"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-test-coverage-{timestamp}.log"
  - evidence: "tmp/evidence-test-coverage.json"
  - coverage_report: "tmp/coverage/"
---

# テストカバレッジ改善デバッグワークフロー

## 目的

現在43.6%のテストカバレッジを80%以上に引き上げ、DDD/TDD原則に準拠した堅牢なテスト体系を確立する。

## 前提条件

- [ ] 条件1: Deno環境が正しく設定されている
- [ ] 条件2: 全依存パッケージがインストール済み
- [ ] 条件3: BreakdownLoggerが設定済み

## 入力

- **対象**: 全ドメインサービスとコアコンポーネント
- **症状**: テストカバレッジ43.6% (要求: 80%)
- **コンテキスト**: 7テストのみ実行、大部分のテストが未実装

## ワークフロー手順

### ステップ1: 現状の詳細分析

{xml:step id="step1" type="verification"}

1. カバレッジレポートの生成
   ```bash
   deno task test:coverage
   ```

2. 低カバレッジファイルのリスト化
   ```bash
   grep -E "^\[0m\[31m" tmp/coverage/lcov-report/index.html | head -20
   ```

3. テスト実行状況の確認
   ```bash
   deno test --allow-all | grep -E "^(ok|FAILED)" | wc -l
   ```

期待される結果: カバレッジ詳細と未テスト領域の明確化
{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定
   ```bash
   export LOG_KEY=test-coverage-analysis LOG_LEVEL=debug LOG_LENGTH=L
   ```

2. BreakdownLogger有効化確認
   ```bash
   echo "LOG_KEY: $LOG_KEY, LOG_LEVEL: $LOG_LEVEL"
   ```

3. 出力先ディレクトリ確認
   ```bash
   mkdir -p tmp/coverage tmp/debug
   ```
{/xml:step}

### ステップ3: 段階的調査 - コア型システム

{xml:step id="step3" type="investigation"}

1. Result型のテスト実装状況
   ```bash
   find src -name "result.ts" | xargs grep -E "class|interface|type"
   deno test --allow-all tests/**/result*_test.ts 2>&1 | tail -20
   ```

2. エラー処理のテスト実装状況
   ```bash
   find src -name "errors.ts" | xargs grep -E "class.*Error"
   deno test --allow-all tests/**/error*_test.ts 2>&1 | tail -20
   ```

3. スキーマ定義のテスト実装状況
   ```bash
   find src -name "schema*.ts" | xargs grep -E "class|interface"
   deno test --allow-all tests/**/schema*_test.ts 2>&1 | tail -20
   ```
{/xml:step}

### ステップ4: 問題特定 - ドメインサービス

{xml:step id="step4" type="diagnosis"}

1. DataProcessingInstructionDomainServiceの分析
   ```bash
   LOG_KEY=data-processing-service deno test tests/unit/domain/data-processing/**/*_test.ts --allow-all
   ```

2. ThreeDomainOrchestratorの分析
   ```bash
   LOG_KEY=orchestrator deno test tests/e2e/*orchestrator*_test.ts --allow-all
   ```

3. 24実行パターンテストの確認
   ```bash
   find tests -name "*_test.ts" | xargs grep -l "24.*pattern\|execution.*pattern" | wc -l
   ```

根本原因仮説:
- 基盤型システムのテスト未実装
- ドメインサービスの統合テスト不足
- 24実行パターンテストの完全欠如
{/xml:step}

### ステップ5: 検証・解決 - テスト実装優先順位

{xml:step id="step5" type="resolution"}

1. 優先度1: Result型とエラー処理の完全テスト化
   - src/domain/shared/types/result.ts → 100%カバレッジ目標
   - src/domain/shared/types/errors.ts → 100%カバレッジ目標

2. 優先度2: スキーマコンポーネントのテスト
   - schema-definition.ts → 80%カバレッジ目標
   - schema-extension-registry.ts → 80%カバレッジ目標
   - schema-path.ts → 80%カバレッジ目標

3. 優先度3: ドメインサービスのテスト
   - DataProcessingInstructionDomainService → 70%カバレッジ目標
   - ThreeDomainOrchestrator → 70%カバレッジ目標

4. 優先度4: 24実行パターンテストの新規実装
   - 基本パターン12個
   - エラーパターン6個
   - エッジケース6個
{/xml:step}

### ステップ6: 実装計画

{xml:step id="step6" type="implementation"}

1. テストファイル作成スクリプト
   ```bash
   # Result型テスト作成
   cat > tests/unit/domain/shared/types/result_comprehensive_test.ts << 'EOF'
   import { assertEquals, assertExists } from "@std/assert";
   import { Result, Ok, Err } from "../../../../../src/domain/shared/types/result.ts";

   Deno.test("Result Type - Comprehensive Tests", async (t) => {
     // 実装する
   });
   EOF
   ```

2. カバレッジ監視スクリプト
   ```bash
   # 継続的カバレッジ監視
   watch -n 10 'deno task test:coverage 2>&1 | grep "All files"'
   ```

3. 段階的実装確認
   ```bash
   # 各段階でのカバレッジ確認
   deno task test:coverage && echo "Current coverage achieved"
   ```
{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-test-coverage-{timestamp}.log`
- **証跡データ**: `tmp/evidence-test-coverage.json`
- **カバレッジレポート**: `tmp/coverage/`
- **解決策**: 段階的テスト実装による80%カバレッジ達成

## 成功基準

- [ ] 全体カバレッジ80%以上達成
- [ ] Result型とエラー処理100%カバレッジ
- [ ] 各ドメインサービス70%以上カバレッジ
- [ ] 24実行パターンテスト実装完了
- [ ] CI/CDパイプラインでのカバレッジ監視設定

## 関連ワークフロー

- [01-totality-verification.workflow.md](./01-totality-verification.workflow.md)
- [05-hardcoding-violation-analysis.workflow.md](./05-hardcoding-violation-analysis.workflow.md)
- [07-requirement-implementation-gap.workflow.md](./07-requirement-implementation-gap.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: テスト実行時のタイムアウト

- **症状**: テストが終了しない
- **原因**: 非同期処理の未完了
- **解決策**: `sanitizeOps: false, sanitizeResources: false` オプション追加

#### 問題2: カバレッジが正しく計測されない

- **症状**: 実行したはずのコードがカバレッジに反映されない
- **原因**: デコレータやメタプログラミングの使用
- **解決策**: `--coverage=tmp/coverage` オプションの明示的指定

#### 問題3: テスト間の依存関係

- **症状**: 単独実行は成功するが全体実行で失敗
- **原因**: グローバル状態の汚染
- **解決策**: 各テストでの完全な初期化とクリーンアップ

## 実行コマンド例

```bash
# 完全なワークフロー実行
./scripts/run-workflow.sh docs/tests/debugs/02-architecture/test-coverage-improvement.workflow.md architecture system

# 個別ステップ実行
LOG_KEY=test-coverage-step1 deno task test:coverage

# 継続的改善モード
while true; do
  deno task test:coverage
  echo "Press Ctrl+C to stop, or wait for next iteration..."
  sleep 60
done
```

## 24実行パターン定義

### 基本パターン (12個)

1. 単一ファイル処理
2. 複数ファイル処理
3. グロブパターン処理
4. ディレクトリ処理
5. スキーマ検証成功
6. テンプレート適用
7. x-frontmatter-part処理
8. x-derived-from処理
9. x-derived-unique処理
10. x-jmespath-filter処理
11. YAML出力
12. JSON出力

### エラーパターン (6個)

13. ファイル不在
14. スキーマ検証失敗
15. テンプレート不在
16. 無効なフロントマター
17. 循環参照
18. メモリ不足

### エッジケース (6個)

19. 空ファイル
20. 巨大ファイル
21. 特殊文字含有
22. ネストした$ref
23. 相対パス解決
24. 並行処理競合

## 完了後の検証

```bash
# 最終カバレッジ確認
deno task test:coverage

# GitHub Issue更新
gh issue comment 1100 --body "カバレッジ改善完了: XX%達成"

# CI/CD設定確認
cat .github/workflows/test.yml | grep coverage
```