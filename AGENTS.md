# Zzp Sub independent maintenance

This is the independent v1.0.0+ version line derived from imzyb/MiSub v2.7.0. Keep its upstream MIT license and copyright in LICENSE, maintain NOTICE.md, and keep brand titles/logo/version aligned per docs/BRANDING.md.

This is zzpice's independent Zzp Sub repository. Preserve the mature upstream architecture and MIT notices. Read docs/PERSONAL-MAINTENANCE.md before changing deployment or persistence behavior.

- Modify only the existing production Zzp Sub service: Cloudflare Pages `misub`, domain `sub.zzp.moe`, and its dedicated production D1/KV when explicitly authorized. The old Cloudflare Sub-Store deployment is retired and must not be recreated. The separate NAS/internal Sub-Store must remain untouched.
- Keep MISUB_PERSONAL_MODE=true and D1 authoritative. Never restore a KV authentication fallback, public sharing defaults, default admin credentials, or default subscription tokens.
- ADMIN_PASSWORD, COOKIE_SECRET, SUBSCRIPTION_TOKEN and PROFILE_TOKEN are independent Cloudflare Secrets. Do not assume any particular credential vault is authoritative; never read, reproduce, rotate, export, or commit credential values during routine code maintenance.
- Read real subscription configuration only when required for the authorized task. Use synthetic fixtures for ordinary tests; never seed test nodes in production.
- This repository currently uses only `main`; no preview branch or preview D1/KV/Secrets are maintained. Do not recreate them without explicit authorization. Use synthetic data in local isolated tests, and verify actual bindings plus backup/recovery plans before any authorized production data change. Pages rollback does not restore D1.
- Do not add upstream sync, automatic upgrades, scheduled deployments, forced pushes or resets to main. Fetch upstream only for a user-requested review and select individual verified improvements.
- Run relevant tests and npm run build. For dependency changes, check npm audit; for protocol conversion changes, validate generated full configurations with actual supported Mihomo and sing-box tools.
- A Git push is not deployment completion. Verify the deployed commit, login/access controls and persistence. Report unavailable test conditions explicitly.

Use one dashboard shell and page-based settings. Do not restore legacy layouts, duplicate settings modals or credential-bearing browser caches. The public brand is Zzp Sub; existing MISUB_* bindings, database keys, backup paths and wire headers remain stable technical contracts.
