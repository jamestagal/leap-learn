# Technical Debt Scanner

Scan the codebase for technical debt and code quality issues.

## Instructions

Scan the codebase for:

1. **Duplicated Code** - Code blocks with >10 similar lines
2. **Stale TODOs** - TODO/FIXME comments (prioritize any with dates or issue refs)
3. **Long Functions** - Functions longer than 50 lines
4. **Dead Code** - Unused exports, unreachable code paths
5. **Missing Error Handling** - Async operations without try/catch, unhandled promise rejections
6. **Type Safety Issues** - `any` types, missing type annotations in key areas

## Output Format

For each issue found, output:

| Location | Category | Severity | Suggested Fix |
|----------|----------|----------|---------------|
| `file:line` | Category | High/Medium/Low | Brief fix description |

## Scope

Focus on:
- `service-client/src/` - SvelteKit frontend
- `app/service-core/` - Go backend

Skip:
- `node_modules/`, `build/`, generated files
- Test files (unless specifically requested)

## Priority

Sort by severity (High first), then by file location.

## Example

```
| Location | Category | Severity | Suggested Fix |
|----------|----------|----------|---------------|
| `billing.remote.ts:45` | Duplicated Code | Medium | Extract to shared helper |
| `handler.go:120` | Long Function | Low | Split into smaller handlers |
```
