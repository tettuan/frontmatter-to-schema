# 共有型定義

## Result型（全域性原則の基盤）

```typescript
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

## 共通エラー型

```typescript
export type ValidationError =
  | { kind: "EmptyInput"; message: string }
  | { kind: "PatternMismatch"; value: string; pattern: string; message: string }
  | {
    kind: "InvalidFormat";
    value: string;
    expectedFormat: string;
    message: string;
  }
  | { kind: "ValidationFailed"; errors: any[]; message: string };
```
