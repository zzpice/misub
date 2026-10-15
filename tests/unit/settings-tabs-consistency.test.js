import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
describe('settings navigation', () => {
    it('mounts every advertised settings section only when selected', async () => {
        const sidebar = await readFile('src/components/settings/SettingsSidebar.vue', 'utf8');
        const content = await readFile('src/components/settings/SettingsContent.vue', 'utf8');
        const tabs = [
            ...sidebar.matchAll(/\{\s*id:\s*'([a-z-]+)',\s*labelKey:\s*'settings\.tabs\./g),
        ].map((m) => m[1]);
        expect(tabs).toEqual(['basic', 'global', 'service', 'system']);
        for (const tab of tabs) expect(content).toContain(`v-if="activeTab === '${tab}'"`);
    });
});
