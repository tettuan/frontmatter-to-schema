# テスト実行ガイド

> **役割**:
> このドキュメントは**テスト実行の実践的ガイド**です。
>
> **関連ドキュメント**:
> - [テスト概要](./README.md): テスト哲学とアーキテクチャ
> - [デバッグ戦略](./test-debugging.md): BreakdownLoggerを使用したデバッグ手法
> - このドキュメント: 実践的な実行手順とDDD基盤の構造

## 現在の状況

### テスト戦略の確立

**ドメイン駆動設計**に基づくテスト戦略が確立されています：

- **テスト配置**: `tests/` 配下（番号付きドメイン構造）
- **実行状況**: 188テストファイルの完全移行完了
- **戦略レイヤー**: 単体テスト、統合テスト、比較テスト（BreakdownLogger活用）

## テスト戦略レイヤー

### 1. 単体テスト (Unit Tests)

個々のコンポーネント・関数・クラスの動作を独立して検証します。

### 2. 統合テスト (Integration Tests)

複数のコンポーネント間の協調動作を検証します。

### 3. 比較テスト (Comparison Tests)

**BreakdownLoggerを活用した実行時プロセス評価戦略**

比較テストは、特定の処理（フィルタリング、変換、最適化など）の有無による結果の差異を検証する戦略的テスト手法です。

#### 比較テストの特徴

- **目的**: 処理の効果を定量的・定性的に評価
- **手法**: BreakdownLoggerによる実行時プロセスの詳細追跡
- **検証内容**:
  - フィルタリング対象データの存在確認
  - 処理実行前後の状態比較
  - 期待される結果への変換確認

#### 実装例：フィルタリング処理の比較テスト

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";
import { assertEquals } from "@std/assert";

Deno.test("比較テスト: フィルタリング処理の効果検証", async () => {
  const logger = new BreakdownLogger("comparison-test");

  // テストデータ（フィルタリング対象を含む）
  const testData = [
    { id: 1, active: true, name: "Alice" },
    { id: 2, active: false, name: "Bob" },  // フィルタリング対象
    { id: 3, active: true, name: "Charlie" },
  ];

  // 処理なしの場合
  logger.debug("フィルタリング前の状態", { count: testData.length });
  const withoutFilter = testData;

  // フィルタリング処理ありの場合
  logger.debug("フィルタリング処理開始");
  const withFilter = testData.filter(item => {
    const keep = item.active;
    logger.trace("フィルタリング判定", {
      id: item.id,
      active: item.active,
      keep
    });
    return keep;
  });

  // 結果の比較検証
  logger.info("比較結果", {
    before: withoutFilter.length,
    after: withFilter.length,
    filtered: withoutFilter.length - withFilter.length
  });

  // アサーション
  assertEquals(withFilter.length, 2);
  assertEquals(withFilter.every(item => item.active), true);
});
```

#### 比較テストの適用場面

1. **フィルタリング処理**: データの絞り込み効果の検証
2. **変換処理**: データ形式変換の正確性確認
3. **最適化処理**: パフォーマンス改善の効果測定
4. **キャッシュ処理**: キャッシュ有無による動作の一貫性確認
5. **条件分岐処理**: 各分岐パスの結果比較

### テスト配置の方針

- **単体テスト**: `src/`配下の実装ファイルと同じディレクトリに配置
- **統合・E2Eテスト**: `tests/`配下の独立したテストディレクトリに配置

```
src/                          # 実装ファイル + 単体テスト
├── domain/
│   ├── service.ts
│   └── service.test.ts       # 単体テスト（実装と同じ場所）
└── ...

tests/                        # 統合・E2Eテスト専用
├── 0_core_domain/            # 核心ドメイン統合テスト
├── 4_cross_domain/           # ドメイン間統合テスト
│   ├── collaboration/        # ドメイン間協働・結合テスト
│   └── e2e/                 # システム全体のE2Eテスト
└── ...
```

## テスト実行方法

### 基本的な実行方法

```bash
# 単体テスト実行（src/配下）
deno test src/

# 統合・E2Eテスト実行（tests/配下）
deno test tests/

# 全テスト実行（推奨：単体テスト → 統合テスト の順序）
deno test src/ && deno test tests/

# 全ドメインテスト実行（番号順に実行される）
deno test tests/

# ドメイン別実行（推奨される実行順序）
deno test tests/0_core_domain/        # 核心ドメイン（最優先）
deno test tests/1_supporting_domain/  # 支援ドメイン
deno test tests/2_generic_domain/     # 技術基盤
deno test tests/3_interface_layer/    # インターフェース層
deno test tests/4_cross_domain/       # 統合テスト（最後）
```

### テストカテゴリ別実行

```bash
# 単体テスト（src/配下）
deno test src/ --filter="0_architecture"  # アーキテクチャ制約テスト
deno test src/ --filter="1_behavior"      # 動作検証テスト
deno test src/ --filter="2_structure"     # 構造整合性テスト

# 統合・E2Eテスト（tests/配下）
deno test tests/*/3_core/             # コア機能テスト
deno test tests/4_cross_domain/e2e/     # E2Eテスト
deno test tests/4_cross_domain/collaboration/  # 結合テスト
```

### 実行順序の設計思想

1. **`0_architecture/`**: システムの基盤が正しく構築されていることを最初に検証
2. **`1_behavior/`**: 基本機能が正常に動作することを検証
3. **`2_structure/`**: データ構造の整合性を検証
4. **`3_core/`**: ドメイン内統合機能を検証
5. **`4_cross_domain/`**: システム全体の協働を最後に検証

### CI/CDでの実行

```bash
# 従来のCI実行方法（スクリプト使用）
bash scripts/local_ci.sh

# 段階的実行（推奨）
deno test src/                    # 単体テスト
deno test tests/0_core_domain/    # 核心ドメイン統合テスト
deno test tests/4_cross_domain/   # E2E・結合テスト
```

## デバッグとログ出力

### BreakdownLoggerの戦略的活用

BreakdownLoggerは**テストコードでのみ使用**し、以下の戦略的目的で活用します：

#### 1. 実行時プロセス評価（比較テスト）

```typescript
import { BreakdownLogger } from "@tettuan/breakdownlogger";

const logger = new BreakdownLogger("comparison-test");
// 処理前後の状態を詳細に記録
logger.debug("処理前状態", { data: beforeState });
// 処理中の判定ロジックを追跡
logger.trace("処理判定", { condition, result });
// 処理後の結果を記録
logger.info("処理後状態", { data: afterState });
```

#### 2. ドメインテストでの利用

```typescript
const logger = new BreakdownLogger("domain-test");
logger.debug("ドメインテスト実行開始", {
  domain: "core_domain",
  testCase: "prompt_path_resolution",
});
```

#### 3. デバッグ・問題調査

```typescript
const logger = new BreakdownLogger("debug-test");
logger.error("エラー発生", { error, context });
logger.warn("予期しない状態", { expected, actual });
```

### デバッグログレベルとフィルタリング

- `LOG_LEVEL`: debug, info, warn, error
- `LOG_KEY`: 特定モジュールのフィルタリング
- `LOG_LENGTH`: メッセージ長制御

詳細は [debug.ja.md](./debug.ja.md) を参照してください。

### LOG_KEY による特定ログの抽出

特定のキーワードを含むログメッセージのみを出力：

```bash
# 特定の機能に関連するログのみ表示
LOG_KEY="parser" deno test --allow-env --allow-write --allow-read

# 複数のキーワードでフィルタリング
LOG_KEY="parser,validation" deno test --allow-env --allow-write --allow-read
```

### LOG_LENGTH による出力制御

```bash
# 短縮表示（100文字）
LOG_LENGTH=S deno test --allow-env --allow-write --allow-read

# 詳細表示（制限なし）
LOG_LENGTH=W deno test --allow-env --allow-write --allow-read
```

### テスト段階別のログ設定

```bash
# 開発・デバッグ時
LOG_LEVEL=debug LOG_LENGTH=W deno test

# 特定機能のテスト時
LOG_KEY="target_function" LOG_LEVEL=debug deno test

# CI実行時
LOG_LEVEL=info LOG_LENGTH=S deno test
```

## エラー処理とデバッグ

### エラー発生時の調査手順

1. デバッグログの確認
2. テスト環境の状態確認
3. 関連するテストケースの実行
4. エラー再現手順の文書化

### テスト失敗時の対応

1. エラーメッセージの確認
2. デバッグモードでの再実行
3. 関連する実装の確認
4. テスト失敗の前処理判定
5. 修正と再テスト

### テスト失敗の前処理判定

- テストの目的ではない前処理で失敗した場合、別の処理前のテストが必要
- 前処理のテストは実行順を前段階で配置する
- 前処理の例：
  - 設定判定のテストだが設定ファイルの読み込みに失敗する →
    設定ファイルの読み込みテストを作る
- テストの前処理は、該当テストより前に実施された確認済みプロセスを利用すること
