# Issue: Dynamic Command Discovery for climpt-* Commands

## 現状分析

### 良い実装 ✅

- `RegistryBuilderAdapter.extractAvailableConfigs()` は動的にc1値を抽出している
- `docs/requirements.ja.md` は動的な発見を期待している

### 問題点 🚨

#### 1. テストファイルのハードコーディング

テストファイルに `climpt-build`, `climpt-design`, `climpt-spec`
などの具体的な値がハードコードされている：

- `tests/unit/application/adapters/registry-builder-adapter.test.ts`
- `tests/unit/application/adapters/command-processor-adapter.test.ts`

#### 2. フックスクリプトのハードコーディング

以下のスクリプトに特定のコマンド名がハードコードされている：

- `scripts/hook_stops.sh`: `climpt-meta`, `climpt-debug`
- `scripts/hook_stops_docs.sh`: `climpt-debug`

## 改善提案

### 1. テストデータの抽象化

```typescript
// test-fixtures/command-fixtures.ts
export const TEST_COMMAND_CATEGORIES = {
  BUILD: "command-category-build",
  DESIGN: "command-category-design",
  SPEC: "command-category-spec"
} as const;

// テストで使用
const commands: Command[] = [
  { c1: TEST_COMMAND_CATEGORIES.BUILD, ... }
];
```

### 2. 動的コマンド発見メカニズム

```typescript
// src/domain/services/command-discovery.ts
export interface CommandDiscoveryService {
  discoverAvailableCommands(path: string): Promise<string[]>;
  validateCommandExists(command: string): boolean;
}
```

### 3. スクリプトの改善

フックスクリプトで特定のコマンド名を環境変数や設定ファイルから読み込む：

```bash
# .env または config
DEFAULT_DEBUG_COMMAND="${CLIMPT_DEBUG_COMMAND:-climpt-debug}"
DEFAULT_META_COMMAND="${CLIMPT_META_COMMAND:-climpt-meta}"
```

## 期待される効果

1. **柔軟性の向上**: 新しいコマンドカテゴリを追加しても、コードの変更が不要
2. **保守性の向上**: ハードコーディング禁止規定への準拠
3. **テストの堅牢性**: テストデータと実装の分離
4. **DDD原則の遵守**: ドメイン知識の適切なカプセル化

## 対応優先度

**高** - アーキテクチャの柔軟性に直接影響するため

## 関連ドキュメント

- `docs/requirements.ja.md`: 動的発見の要求事項
- `docs/development/prohibit-hardcoding.ja.md`: ハードコーディング禁止規定
- `docs/development/ai-complexity-control.md`: AI複雑性制御

## タスク

- [ ] テストフィクスチャの作成
- [ ] CommandDiscoveryServiceの実装
- [ ] 既存テストのリファクタリング
- [ ] フックスクリプトの設定化
- [ ] ドキュメントの更新
