import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Card from '../../src/components/ui/Card.vue';
import { createI18n } from '../../src/i18n/index.js';

const GIB = 1024 ** 3;

function mountCard(userInfo, other = {}) {
    return mount(Card, {
        props: {
            misub: {
                id: 'sub_test',
                name: '测试订阅',
                url: 'https://example.com/sub',
                enabled: true,
                nodeCount: 2,
                autoUpdateEnabled: true,
                autoUpdateIntervalMinutes: 60,
                userInfo,
                ...other,
            },
        },
        global: {
            plugins: [createI18n({ initialLocale: 'zh-CN' })],
            stubs: { Switch: { template: '<button class="switch-stub"></button>' } },
        },
    });
}

describe('subscription card remaining traffic', () => {
    it('shows remaining bytes as the primary value and preserves the existing progress style', () => {
        const wrapper = mountCard({
            total: 120 * GIB,
            download: 37.45 * GIB,
            upload: 0,
        });

        expect(wrapper.text()).toContain('剩余流量');
        expect(wrapper.text()).toContain('82.55 GB / 120 GB');
        expect(wrapper.text()).toContain('已用 37.45 GB');
        expect(wrapper.text()).toContain('剩余 68.8%');
        expect(wrapper.text()).toContain('自动更新 · 60 分钟');
        expect(wrapper.text()).toContain('2 个节点');

        const progress = wrapper.get('[data-testid="traffic-remaining-progress"]');
        expect(progress.attributes('role')).toBe('progressbar');
        expect(progress.attributes('aria-valuenow')).toBe('69');
        expect(progress.attributes('style')).toMatch(/width:\s*68\.79/);
        expect(progress.classes()).toContain('bg-gradient-to-r');
    });

    it('never shows negative remaining traffic when usage exceeds the limit', () => {
        const wrapper = mountCard({
            total: 10 * GIB,
            download: 12 * GIB,
            upload: 0,
        });

        expect(wrapper.text()).toContain('0 B / 10 GB');
        expect(wrapper.text()).toContain('已用 12 GB');
        expect(wrapper.text()).toContain('剩余 0.0%');
        expect(
            wrapper.get('[data-testid="traffic-remaining-progress"]').attributes('style')
        ).toContain('width: 0%');
    });

    it.each([
        [null, 'missing metadata'],
        [{ total: 0, download: 0, upload: 0 }, 'zero total'],
        [{ total: 10 * GIB, download: -1, upload: 0 }, 'negative usage'],
        [{ total: 10 * GIB, download: Number.NaN, upload: 0 }, 'invalid usage'],
    ])('keeps the fallback instead of displaying broken percentages for %s (%s)', (info) => {
        const wrapper = mountCard(info);

        expect(wrapper.text()).toContain('暂无流量数据');
        expect(wrapper.find('[data-testid="traffic-remaining-progress"]').exists()).toBe(false);
    });
});
