# PosBakso V2 RC2 — Final Build/QA Evidence

Generated: 11 October 2026 (Asia/Makassar)

> Catatan: runtime ini tidak dapat mengakses npm registry, sehingga production Vite build nyata tetap merupakan workstation gate. Evidence berikut adalah pemeriksaan yang benar-benar dijalankan tanpa mengklaim build dependency yang tidak dilakukan.

## Static QA

```text
QA checks passed: 46
Static QA: PASS
```

## Domain Math Tests

```text
TAP version 13
# (node:5822) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: order totals separate net items from tax/service
ok 1 - order totals separate net items from tax/service
  ---
  duration_ms: 2.970709
  type: 'test'
  ...
# Subtest: discount never exceeds subtotal
ok 2 - discount never exceeds subtotal
  ---
  duration_ms: 0.182841
  type: 'test'
  ...
# Subtest: weighted average purchase cost
ok 3 - weighted average purchase cost
  ---
  duration_ms: 0.123886
  type: 'test'
  ...
# Subtest: stock delta preserves mathematical ledger including negative stock
ok 4 - stock delta preserves mathematical ledger including negative stock
  ---
  duration_ms: 0.140772
  type: 'test'
  ...
# Subtest: discount allocation is proportional
ok 5 - discount allocation is proportional
  ---
  duration_ms: 0.119644
  type: 'test'
  ...
# Subtest: split tender must balance total
ok 6 - split tender must balance total
  ---
  duration_ms: 0.133418
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 745.711429
```

## TypeScript Parser Sweep

```text
TS/TSX files: 42
Parse errors: 0
```

## Structure / JSON / CSS

```text
CSS braces: 877/877
JSON OK: package.json
JSON OK: firebase.json
JSON OK: firestore.indexes.json
JSON OK: capacitor.config.json
JSON OK: public/manifest.webmanifest
Files total: 90
TS/TSX: 42
Docs: 7
```
