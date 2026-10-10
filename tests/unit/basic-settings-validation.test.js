import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BasicSettings from '../../src/components/settings/sections/BasicSettings.vue';
import { createI18n } from '../../src/i18n/index.js';

function mountSettings(settings) {
    return mount(BasicSettings, {
        props: { settings },
        global: {
            plugins: [createI18n({ initialLocale: 'zh-CN' })],
            stubs: { Switch: { template: '<div />' } },
        },
    });
}

describe('BasicSettings personal-mode controls', () => {
    it('does not offer editing Secret-owned tokens or custom login paths', () => {
        const settings = {
            FileName: 'MiSub',
            mytoken: 'existing-token',
            profileToken: 'existing-profile-token',
            customLoginPath: 'old-admin-path',
        };
        const wrapper = mountSettings(settings);

        expect(wrapper.find('#setting-mytoken').exists()).toBe(false);
        expect(wrapper.find('#setting-profileToken').exists()).toBe(false);
        expect(wrapper.text()).not.toContain('Web 访问控制');
        expect(settings.mytoken).toBe('existing-token');
        expect(settings.profileToken).toBe('existing-profile-token');
        expect(settings.customLoginPath).toBe('old-admin-path');
    });

    it('keeps subscription filename and relevant traffic settings editable', async () => {
        const settings = { FileName: 'MiSub', autoUpdateInterval: 0, mergeExpireStrategy: 'max' };
        const wrapper = mountSettings(settings);

        expect(wrapper.text()).toContain('显示流量与到期时间节点');
        expect(wrapper.text()).toContain('合并到期时间');
        const input = wrapper.find('input');
        expect(input.exists()).toBe(true);
        await input.setValue('MyProfile');
        expect(settings.FileName).toBe('MyProfile');
    });
});
