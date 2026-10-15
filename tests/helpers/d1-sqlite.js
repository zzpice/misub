// Local SQLite only: execute actual D1 SQL without any Cloudflare bindings.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function createSqliteD1() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
    const db = {
        sqlite,
        beforeRun: null,
        prepare(sql) {
            const statement = sqlite.prepare(sql);
            const bound = (args = []) => ({
                bind: (...values) => bound(values),
                async first() {
                    return statement.get(...args) || null;
                },
                async all() {
                    return { results: statement.all(...args) };
                },
                async run() {
                    if (db.beforeRun) await db.beforeRun(sql, args);
                    const result = statement.run(...args);
                    return { success: true, meta: { changes: Number(result.changes) } };
                },
            });
            return bound();
        },
        async batch(statements) {
            sqlite.exec('BEGIN');
            try {
                const results = [];
                for (const statement of statements) results.push(await statement.run());
                sqlite.exec('COMMIT');
                return results;
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        },
        close() {
            sqlite.close();
        },
    };
    return db;
}
