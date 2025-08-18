# システムアーキテクチャ設計書

## ドメイン境界線設計

### ドメイン構成

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   CLI Handler   │  │  Config Loader  │  │ Error Logger │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                     Domain Services                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │Registry Builder │  │Analysis Pipeline│  │Schema Mapper │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                      Domain Entities                        │
│ ┌──────────────┐ ┌───────────────┐ ┌────────────────────────┐│
│ │File System   │ │Frontmatter    │ │Command Mapping         ││
│ │Domain        │ │Analysis       │ │Domain                  ││
│ │              │ │Domain         │ │                        ││
│ │- PromptFile  │ │- FrontmatterData │ │- CommandStructure  ││
│ │- FileCollection│ │- TemplateVar │ │- RegistryEntry     ││
│ └──────────────┘ └───────────────┘ └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                      │
│ ┌──────────────┐ ┌───────────────┐ ┌────────────────────────┐│
│ │Deno File     │ │Claude API     │ │JSON Writer             ││
│ │Reader        │ │Client         │ │                        ││
│ └──────────────┘ └───────────────┘ └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### イベントフロー

```
File Discovery → Frontmatter Extraction → Claude Analysis → Schema Mapping → Registry Generation
```

## TypeScript型定義

```typescript
// Domain Types
interface PromptFile {
  path: string;
  content: string;
  commandStructure: CommandStructure;
}

interface FrontmatterData {
  title?: string;
  description?: string;
  usage?: string;
  [key: string]: unknown;
}

interface CommandStructure {
  c1: string; // domain
  c2: string; // directive
  c3: string; // layer
  input: string;
  adaptation?: string;
}

interface RegistryEntry {
  c1: string;
  c2: string;
  c3: string;
  description: string;
  usage: string;
  options: {
    input: string[];
    adaptation: string[];
    input_file: boolean[];
    stdin: boolean[];
    destination: boolean[];
  };
}
```
