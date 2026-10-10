import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TransformCard from '../../src/components/settings/sections/ServiceSettings/TransformCard.vue';
import { createI18n } from '../../src/i18n/index.js';

function mountCard(settings) {
    return mount(TransformCard, {
        props: { settings },
        global: {
            plugins: [createI18n({ initialLocale: 'en-US' })],
            stubs: { TransformSelector: true, RuleTemplateManager: true },
        },
    });
}

function settingsWithHistoricalBackend() {
    return {
        transformConfigMode: 'builtin',
        transformConfig: 'builtin:clash_misub',
        ruleLevel: 'std',
        builtinSkipCertVerify: true,
        builtinEnableUdp: true,
        subconverter: { engineMode: 'external', defaultBackend: 'example.invalid' },
    };
}

describe('TransformCard in the personal edition', () => {
    it('does not expose disabled third-party converter controls or mutate saved history', () => {
        const settings = settingsWithHistoricalBackend();
        const wrapper = mountCard(settings);

        expect(wrapper.find('[data-testid="test-subconverter-backend"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="engine-change-notice"]').exists()).toBe(false);
        expect(wrapper.text()).not.toContain('External backend parameters');
        expect(wrapper.text()).not.toContain('Test backend availability');
        expect(settings.subconverter.engineMode).toBe('external');
        expect(settings.subconverter.defaultBackend).toBe('example.invalid');
    });

    it('keeps rule source selection and the built-in conversion controls', async () => {
        const settings = settingsWithHistoricalBackend();
        const wrapper = mountCard(settings);

        expect(wrapper.findAll('select').length).toBeGreaterThan(0);
        expect(wrapper.findComponent({ name: 'TransformSelector' }).exists()).toBe(true);
        expect(wrapper.text()).toContain('UDP');
        await wrapper.find('select').setValue('custom_template');
        expect(settings.transformConfigMode).toBe('custom_template');
        expect(settings.builtinSkipCertVerify).toBe(true);
        expect(settings.builtinEnableUdp).toBe(true);
    });
});
