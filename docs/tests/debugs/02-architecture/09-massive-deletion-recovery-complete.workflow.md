---
# XML変換メタデータ
workflow:
  id: "massive-deletion-recovery-complete"
  type: "recovery"
  scope: "architecture"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-massive-deletion-recovery-{timestamp}.log"
  - evidence: "tmp/evidence-massive-deletion.json"
  - ci_results: "tmp/ci-results-{timestamp}.json"
---

# 大規模ファイル削除からの完全復旧ワークフロー

## 目的

93ファイル削除により278個の型エラーが発生した大規模破綻からの系統的復旧を実現し、CI通過とアーキテクチャ健全性を回復する。

## 前提条件

- [ ] 条件1: GitHub issue #1096 が作成済み
- [ ] 条件2: deno環境が設定済み (deno --version で確認)
- [ ] 条件3: デバッグ用tmpディレクトリが存在 (mkdir -p tmp/)

## 入力

- **対象**: 93ファイル削除による大規模型エラー (278→83エラーに部分回復済み)
- **症状**: CI失敗、型エラー83個、ビルド不可
- **コンテキスト**: DDD境界違反による連鎖破綻、アーキテクチャ課題が根本原因

## ワークフロー手順

### ステップ1: 現状確認とエラー分析

{xml:step id="step1" type="verification"}

1. 現在のエラー数確認
   ```bash
   deno task ci 2>&1 | grep "Found.*errors" | tail -1
   ```

2. 重要エラーパターン抽出
   ```bash
   deno check --all 2>&1 | grep -E "TS[0-9]+" | head -20
   ```

3. 削除されたファイルの影響範囲確認
   ```bash
   git status | grep "^D " | wc -l
   ```

期待結果: エラー数が83以下、主要エラーパターンが特定されている

{/xml:step}

### ステップ2: デバッグ環境設定とBreakdownLogger準備

{xml:step id="step2" type="setup"}

1. デバッグ環境変数設定
   ```bash
   export LOG_KEY=massive-deletion-recovery
   export LOG_LEVEL=debug
   export LOG_LENGTH=L
   ```

2. デバッグ用ディレクトリ準備
   ```bash
   mkdir -p tmp/
   mkdir -p docs/tests/debugs/02-architecture/
   ```

3. CI結果記録の準備
   ```bash
   deno task ci 2>&1 | tee tmp/ci-before-recovery-$(date +%Y%m%d-%H%M%S).log
   ```

{/xml:step}

### ステップ3: 重要エラーの段階的修正

{xml:step id="step3" type="investigation"}

1. **ProcessingError型エラー修正** (優先度: 最高)
   - 実行: `grep -r "ProcessingError" src/ --include="*.ts" | head -10`
   - 修正: 'ProcessingError'文字列を適切なProcessingError union型に変更
   - 確認: 型エラー数の減少を確認

2. **Missing exports修正** (優先度: 高)
   - 実行: `grep -r "has no exported member" . 2>&1`
   - 修正: 不足しているinterface/typeをexport
   - 確認: import エラーの解消

3. **Schema.getRawSchema()問題修正** (優先度: 高)
   - 実行: `grep -r "getRawSchema" src/ --include="*.ts"`
   - 修正: Schemaエンティティへのメソッド追加
   - 確認: Property not exist エラーの解消

{/xml:step}

### ステップ4: アーキテクチャ課題の根本対応

{xml:step id="step4" type="diagnosis"}

1. **FrontmatterTransformationService分析** (2,323行の巨大サービス)
   ```bash
   wc -l src/domain/frontmatter/services/frontmatter-transformation-service.ts
   grep -c "class\|interface\|function" src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```

2. **ドメイン境界違反の特定**
   ```bash
   grep -r "import.*domain" src/domain/ --include="*.ts" | grep -v "shared" | wc -l
   ```

3. **依存関係の複雑さ測定**
   ```bash
   grep -r "^import" src/presentation/cli/cli.ts | wc -l
   ```

根本原因仮説: DDD境界定義と実装の乖離により、単一サービスが複数ドメインを統合

{/xml:step}

### ステップ5: CI通過の確認と健全性検証

{xml:step id="step5" type="resolution"}

1. **段階的CI実行**
   ```bash
   # Type check のみ
   deno check --all 2>&1 | grep "Found.*errors" || echo "Type check passed"

   # 全CI実行
   deno task ci 2>&1 | tee tmp/ci-after-recovery-$(date +%Y%m%d-%H%M%S).log
   ```

2. **テスト実行確認**
   ```bash
   deno test --allow-all 2>&1 | grep -E "passing|failing|pending"
   ```

3. **アーキテクチャ健全性確認**
   ```bash
   # 巨大ファイル検出 (1000行超)
   find src/ -name "*.ts" -exec wc -l {} + | awk '$1 > 1000 {print $0}' | sort -nr

   # 循環依存チェック
   deno check --all 2>&1 | grep -i "circular"
   ```

期待結果: CI通過、テスト成功、1000行超ファイルの特定

{/xml:step}

## 出力

- **CIログ**: `tmp/ci-after-recovery-{timestamp}.log`
- **エラー分析**: `tmp/error-analysis-{timestamp}.json`
- **アーキテクチャ課題**: `tmp/architecture-issues-{timestamp}.md`

## 成功基準

- [ ] CI が完全に通過している (deno task ci の成功)
- [ ] 型エラーが0個になっている
- [ ] テストが全て成功している
- [ ] 1000行超の巨大ファイルがリストアップされている
- [ ] GitHub issue #1096 に進捗がコメントされている

## 関連ワークフロー

- [ProcessingError修正ワークフロー](./08-processing-error-fix.workflow.md)
- [ドメイン境界分析](./07-domain-boundary-analysis.workflow.md)
- [アーキテクチャ健全性チェック](./06-architecture-health-check.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: Still 83 errors remaining

- **症状**: エラー数が減らない
- **原因**: 根本的な型定義の不整合
- **解決策**: `src/domain/shared/types/errors.ts`
  の型定義を確認、不足している型を追加

#### 問題2: Schema.getRawSchema() エラーが解消されない

- **症状**: Property 'getRawSchema' does not exist
- **原因**: Schema エンティティのメソッド不足
- **解決策**: Schema クラスに `getRawSchema(): unknown` メソッドを追加

#### 問題3: CI timeout or memory issues

- **症状**: CI実行時のタイムアウト
- **原因**: 大量エラーによる処理負荷
- **解決策**: batch処理での部分チェック、メモリ制限の調整

#### 問題4: 循環依存エラー

- **症状**: Circular dependency detected
- **原因**: ドメイン間の不適切な依存関係
- **解決策**: 依存関係の再設計、共通interfaceの分離

## 検証コマンド

### 完全性チェック

```bash
# すべてのチェックを実行
echo "=== Type Check ==="
deno check --all

echo "=== Test Execution ==="
deno test --allow-all

echo "=== CI Pipeline ==="
deno task ci

echo "=== Architecture Health ==="
find src/ -name "*.ts" -exec wc -l {} + | awk '$1 > 1000 {print $2 ": " $1 " lines"}'
```

### Issue更新コマンド

```bash
# GitHub issue #1096 に進捗報告
gh issue comment 1096 --body "## 復旧完了報告 $(date)
- CI Status: $(deno task ci >/dev/null 2>&1 && echo "✅ PASSED" || echo "❌ FAILED")
- Type Errors: $(deno check --all 2>&1 | grep "Found.*errors" | grep -o "[0-9]* errors" || echo "0 errors")
- Test Status: $(deno test --allow-all >/dev/null 2>&1 && echo "✅ ALL PASSED" || echo "❌ SOME FAILED")
- Large Files: $(find src/ -name "*.ts" -exec wc -l {} + | awk '$1 > 1000 {print $2}' | wc -l) files over 1000 lines"
```
