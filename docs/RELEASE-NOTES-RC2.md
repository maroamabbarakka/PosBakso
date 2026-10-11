# PosBakso V2 RC2 — Release Notes

## Fokus RC2

RC2 adalah remediation release setelah audit teknis 50 temuan. Fokus utamanya bukan menambah kosmetik, tetapi **integritas transaksi, concurrency multi-terminal, report completeness, receipt/printing precision, security rules, offline recovery, dan operasional outlet**.

## Perubahan utama

- production/demo data dipisah;
- realtime inbound Firestore;
- terminal-safe order numbering;
- idempotent domain sync dengan `sync_events`;
- atomic stock increments + weighted purchase transaction;
- retry/dead-letter sync center;
- per-station KDS;
- held order expiry + delta inventory + delta KOT;
- report full date range + Spark-aware cache;
- accounting semantics diperbaiki;
- modifier BOM;
- stock movement historical cost snapshot;
- cloud merge backup recovery Owner-only;
- Firestore Rules field-level hardening;
- PWA generated precache + PNG/maskable icons;
- mobile `Lainnya`, dynamic branding, Error Boundary, accessible modal;
- custom Receipt Designer lengkap;
- 1-bit ESC/POS logo raster;
- printable head dot calibration;
- native QR/CODE128/cut/drawer/copies/feed/codepage;
- persistent print jobs & Retry;
- static QA, domain tests, GitHub quality workflow.

## Catatan release

RC2 **siap UAT dan deployment staging**. Production sign-off menunggu test environment/perangkat sebagaimana `PRODUCTION-CHECKLIST.md`.
