import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from '../../src/i18n/index.js';
import ServiceSettings from '../../src/components/settings/sections/ServiceSettings.vue';

function mountService(settings) {
    return mount(ServiceSettings, {
        props: { settings },
        global: {
            plugins: [createI18n({ initialLocale: 'zh-CN' })],
            stubs: {
                TransformCard: true,
                DnsOverrideCard: true,
                CronCard: true,
            },
        },
    });
}
function defaults(overrides = {}) {
    return {
        transformConfigMode: 'builtin',
        ruleLevel: 'std',
        builtinEnableUdp: true,
        builtinSkipCertVerify: false,
        customDnsOverride: '',
        cronSecret: '',
        ...overrides,
    };
}

describe('service settings basic/advanced organization', () => {
    it('shows the safe everyday defaults and keeps all advanced sections collapsed', async () => {
        const settings = defaults();
        const wrapper = mountService(settings);
        const details = wrapper.find('#misub-service-advanced');
        expect(wrapper.text()).toContain('日常订阅设置');
        expect(wrapper.text()).toContain('标准版');
        expect(wrapper.find('button[aria-controls="misub-service-advanced"]').attributes('aria-expanded')).toBe('false');
        expect(details.element.style.display).toBe('none');
        await wrapper.find('button[aria-controls="misub-service-advanced"]').trigger('click');
        expect(details.element.style.display).not.toBe('none');
        expect(wrapper.find('button[aria-controls="misub-service-advanced"]').attributes('aria-expanded')).toBe('true');
        expect(settings).toEqual(defaults());
    });

    it('never resets a previously customized source, DNS or secret', async () => {
        const settings = defaults({
            transformConfigMode: 'custom_template',
            transformConfig: 'custom:my-rules',
            ruleLevel: 'full',
            customDnsOverride: 'dns:\\n  enable: true',
            cronSecret: 'existing-secret',
        });
        const before = structuredClone(settings);
        const wrapper = mountService(settings);
        expect(wrapper.find('button[aria-controls="misub-service-advanced"]').attributes('aria-expanded')).toBe('true');
        await wrapper.find('button[aria-controls="misub-service-advanced"]').trigger('click');
        expect(settings).toEqual(before);
        expect(wrapper.text()).toContain('自定义');
        expect(wrapper.text()).toContain('检测到已保存的高级配置');
    });

    it('keeps the UDP setting editable in the everyday settings card', async () => {
        const settings = defaults();
        const wrapper = mountService(settings);
        await wrapper.find('input[type="checkbox"]').setValue(false);
        expect(settings.builtinEnableUdp).toBe(false);
    });
});
