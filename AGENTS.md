# Personal MiSub maintenance

This is zzpice's independent MiSub repository. Preserve the mature upstream architecture and MIT notices. Read docs/PERSONAL-MAINTENANCE.md before changing deployment or persistence behavior.

- Modify only this service's resources: Pages misub, misub.zzp.moe, and its isolated production/preview KV and D1. Existing Sub-Store resources and credentials must remain unchanged.
- Keep MISUB_PERSONAL_MODE=true and D1 authoritative. Never restore a KV authentication fallback, public sharing defaults, default admin credentials, or default subscription tokens.
- ADMIN_PASSWORD, COOKIE_SECRET, SUBSCRIPTION_TOKEN and PROFILE_TOKEN are independent Cloudflare Secrets. Keep effective values consistent with the MiSub section in the private vault. Never automatically rotate them or commit/export them to logs, issues or reports.
- Read real subscription configuration only when required for the authorized task. Use synthetic fixtures for ordinary tests; never seed test nodes in production.
- Preview must use its own database, KV and Secrets. Check the actual bindings before any restore or schema change. Back up before production changes; Pages rollback does not restore D1.
- Do not add upstream sync, automatic upgrades, scheduled deployments, forced pushes or resets to main. Fetch upstream only for a user-requested review and select individual verified improvements.
- Run relevant tests and npm run build. For dependency changes, check npm audit; for protocol conversion changes, validate generated full configurations with actual supported Mihomo and sing-box tools.
- A Git push is not deployment completion. Verify the deployed commit, login/access controls and persistence. Report unavailable test conditions explicitly.
