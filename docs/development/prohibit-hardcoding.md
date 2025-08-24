---
title: "Prohibition of Hardcoding"
description: "Regulations prohibiting hardcoded values in source code to ensure maintainability, security, and environment independence"
compliance_level: strict
version: 1.0
last_updated: 2025-08-19
scope:
  - Python
  - TypeScript
  - Node.js
  - Frontend (React, Next.js)
enforcement:
  - code_review: true
  - CI/CD_check: true
  - secret_scan: true
prohibited_items:
  - API keys
  - passwords
  - URLs and file paths
  - magic numbers
  - environment-dependent values
recommendations:
  - use_env_vars: true
  - use_config_files: true
  - inject_external_values: true
---

# Prohibition of Hardcoding Regulations

## Article 1 (Purpose)

The purpose of these regulations is to prohibit hardcoding in order to ensure code readability, maintainability, security, and eliminate environment dependencies in source code.

## Article 2 (Definitions)

1. "Hardcoding" refers to the act of directly writing fixed values in source code.
2. Fixed values include numbers, strings, paths, URLs, authentication information, environment-dependent settings, and all other constant information.

## Article 3 (Prohibited Actions)

The following actions are prohibited. If violations are confirmed, code review approval and merging will not be permitted until corrections are completed.

1. Directly writing API keys, authentication information, or passwords in source code
2. Fixing environment-specific values (e.g., URLs, port numbers, file paths) in code
3. Directly writing meaningless numbers (magic numbers)
4. Writing values that should be managed through configuration files or environment variables in source code

## Article 4 (Compliance Methods)

1. Constants and configuration values must be managed through one of the following methods and must not be hardcoded:
   - Configuration files (e.g., YAML, JSON, TOML)
   - Environment variables (e.g., `.env` files, CI/CD Secret management)
   - Constant definition files (e.g., `constants.go`, `config.py`)
   - Databases or external systems
2. Environment-dependent values must be designed to be injectable from external sources.

## Article 5 (Review Obligations)

1. During code review, reviewers are obligated to check for the presence of hardcoding.
2. If violations are discovered, the code must not be approved until corrections are made.

## Article 6 (Penalties)

1. When violations of these regulations are confirmed, the following measures will be applied:
   - **First violation**: Return of the pull request, review suspended until corrections completed
   - **Repeated violation**: Code quality guidance for the developer and additional review requirements
   - **Serious violation (hardcoded authentication information, etc.)**: Immediate removal of the code from the repository, revocation of compromised secrets, and formal warning issued by project managers
2. Penalty measures will be determined and executed by project managers or the review team.

## Article 7 (Automated Detection and Enforcement)

1. To ensure compliance with these regulations, automated checks will be implemented in the CI/CD pipeline:
   - **Static analysis tools** to detect fixed values (API keys, URLs, paths, magic numbers, etc.) in source code
   - **Secret Scan** functionality to automatically block hardcoded authentication information
   - **Lint rules** and **regex detection** to identify prohibited items
2. When violations are detected in CI/CD checks, the following measures will be applied:
   - **Build failure** status, prohibiting merge of the branch
   - Automatic notification of reports to developers and review team
   - If secret information is detected, immediate removal from repository history and revocation of the compromised secret
3. Automated detection results will be saved as review records and managed as violation history.

## Article 8 (Violation Example: Python)

```python
# ❌ Regulation violation example
API_KEY = "abcd1234"  
URL = "http://localhost:8080/api"
```

## Article 9 (Proper Example: Python)

```python
# ✅ Regulation compliance example
import os

API_KEY = os.getenv("API_KEY")
URL = os.getenv("API_URL")
```

## Article 10 (Violation Example: TypeScript)

```typescript
// ❌ Regulation violation example
const API_KEY = "abcd1234";
const BASE_URL = "http://localhost:3000/api";

function fetchData() {
  return fetch(`${BASE_URL}/data?key=${API_KEY}`);
}
```

## Article 11 (Proper Example: TypeScript)

```typescript
// ✅ Regulation compliance example
const API_KEY = process.env.API_KEY ?? "";
const BASE_URL = process.env.API_URL ?? "";

function fetchData() {
  return fetch(`${BASE_URL}/data?key=${API_KEY}`);
}
```

### Notes

- For TypeScript/JavaScript, use **`process.env`** in Node.js runtime environments
- For frontend (React, Next.js, etc.), use **build-time environment variable injection** mechanisms (e.g., `NEXT_PUBLIC_` prefix)
- **Environment variable injection and Secret management** are mandatory in CI/CD pipelines

---

All developers must comply with these regulations.
Violations pose serious security risks and increase maintenance costs, therefore no exceptions are permitted for any reason.
When violations are identified through automated detection, responsibility lies with the developer who submitted the code.