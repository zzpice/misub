# Request-driven upstream snapshots

Zzp Sub is a generic HTTP subscription aggregator and distributor, not a device-specific gateway.

## Sources

Each saved HTTP source has `autoUpdateEnabled` (defaults to on for existing entries) and `autoUpdateIntervalMinutes` (minimum 5, default 60). All source types use the same fetch, parse and snapshot path. The "refresh" action on a source is an authenticated explicit operation; merely editing or viewing the management dashboard never fetches an upstream URL.

## Persistence and recovery

Successful **raw** source nodes, update timestamp, node count, traffic metadata and profile title are saved under `misub_source_snapshot_v1_<sourceId>` in the storage adapter. A personal deployment uses D1 as the source of truth. Unlike `node_cache_*`, snapshot entries have no application TTL and are not cleared by aggregate cache cleanup.

Only valid non-empty snapshots are published. A failed fetch, expired source URL, malformed body or suspicious reduction in nodes leaves the previous snapshot unchanged. `misub_source_attempt_v1_*` tracks last attempts for retry backoff. D1 uses conditional lease rows `misub_source_lock_v1_*` with unique owners. Snapshot publication checks the owner, expiry and current source URL atomically, so a stalled task cannot overwrite a newer snapshot or resurrect a deleted source. Legacy migration uses insert-if-absent. Attempt records and lock release are also owner-fenced.

**Important:** D1 data and Cloudflare backups need independent retention and recovery; a GitHub commit or Pages rollback does not recover deleted database rows. Never store credential values in Git. Avoid clearing the production D1 settings table.

## Downstream behavior

Every authenticated or token-based output continues through the original subscription group rules, filtering, prefixing, built-in generators and template conversion. A source snapshot is loaded once per upstream and shared across client types; region metadata survives renaming and emoji removal; downstream configuration variants and snapshot revisions are separated in aggregate cache keys.

When downstream requests arrive, a source whose interval has elapsed triggers a background refresh using Cloudflare Pages Functions `waitUntil`, while its previous snapshot is returned immediately. Without an external scheduler, there is no guaranteed refresh when no client requests arrive. An optional authenticated /cron endpoint now reuses the same durable snapshot refresh service; it does not create a separate cache or require a new Worker. A missing initial snapshot on an enabled source requires a one-time synchronous bootstrap; an automatic-update-disabled source never triggers network access from a downstream request.

For manual-only sources, explicitly click their refresh control once to establish an initial snapshot before distributing their nodes.

## Verification

`npm run test:run` covers permanent snapshots, fallback, isolation, explicit-only updates and same-source concurrency using synthetic data. `npm run build` checks Vue and backend packaging. Tests include local SQLite execution of the actual D1 SQL (concurrent updates, snapshot fencing and counters). Production D1/Secrets must never be used for tests. After deployment, verify Pages commit, protected management routes and snapshots with a source you control. An active Pages deployment does not itself prove cross-region durability.

Anonymous successful GET counts use stable profile IDs. Existing alias counters remain readable and are carried forward on saves/increments without deleting their rows; past counts under unknown former aliases cannot be reconstructed automatically. JSON backups now include valid source snapshots, region corrections and counts; old JSON imports preserve durable records omitted from their format. Full D1 backups remain necessary for complete recovery.
