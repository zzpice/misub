import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.js';
import { applySmartModelOptimizations } from '../../functions/modules/subscription/template-processor.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import yaml from 'js-yaml';
import {
    BUILTIN_TEMPLATE_REGISTRY,
    getBuiltinTemplate,
} from '../../functions/modules/subscription/builtin-template-registry.js';
import { renderSingboxFromIniTemplate } from '../../functions/modules/subscription/template-pipeline.js';
import { getUniqueName } from '../../functions/modules/subscription/name-utils.js';
import { transformBuiltinSubscription } from '../../functions/modules/subscription/transformer-factory.js';
import { fetchRemoteSourceSnapshot } from '../../functions/services/subscription-service.js';
import { fetchTransformTemplate } from '../../functions/modules/subscription/transform-template-cache.js';

const nodes = ['A', 'A', 'A_1', 'A_2', 'A']
    .map((name, i) => `trojan://synthetic-${i}@node${i}.example:443#${name}`)
    .join('\n');

describe('audit: generated names and outbound boundaries', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });
    it('reserves every emitted suffix as well as original names', () => {
        const used = new Map();
        const names = ['A', 'A', 'A_1', 'A_2', 'A'].map((name) => getUniqueName(name, used));
        expect(new Set(names).size).toBe(names.length);
    });
    it.each(['clash', 'singbox', 'surge&ver=4', 'loon', 'quanx', 'egern'])(
        'keeps all distinct connections with colliding names in %s',
        (target) => {
            const output = transformBuiltinSubscription(nodes, target, { addFlagEmoji: false });
            let names;
            if (target === 'clash') names = yaml.load(output).proxies.map((p) => p.name);
            else if (target === 'singbox')
                names = JSON.parse(output)
                    .outbounds.filter((p) => p.server)
                    .map((p) => p.tag);
            else if (target === 'egern')
                names = yaml.load(output).proxies.map((p) => Object.values(p)[0].name);
            else if (target === 'quanx')
                names = output
                    .split('[server_local]')[1]
                    .split(/\n\[/)[0]
                    .match(/tag=([^\n]+)/g)
                    ?.map((p) => p.slice(4));
            else
                names = output
                    .split('[Proxy]')[1]
                    .split(/\n\[/)[0]
                    .split('\n')
                    .filter((p) => /^.+ = trojan/.test(p))
                    .map((p) => p.split(' = ')[0]);
            expect(names).toHaveLength(5);
            expect(new Set(names).size).toBe(5);
        }
    );
    it.each(['clash', 'singbox', 'surge&ver=4', 'loon', 'quanx', 'egern'])(
        'avoids built-in and selector name collisions in %s',
        (target) => {
            const nodeList = ['DIRECT', 'REJECT', '🚀 节点选择']
                .map(
                    (name, i) =>
                        `trojan://synthetic-${i}@node${i}.example:443#${encodeURIComponent(name)}`
                )
                .join('\n');
            const output = transformBuiltinSubscription(nodeList, target, {
                addFlagEmoji: false,
                ruleLevel: 'base',
            });
            if (target === 'clash') {
                const config = yaml.load(output);
                const all = [
                    ...config.proxies.map((p) => p.name),
                    ...config['proxy-groups'].map((g) => g.name),
                    'DIRECT',
                    'REJECT',
                ];
                expect(new Set(all).size).toBe(all.length);
            } else if (target === 'singbox') {
                const all = JSON.parse(output).outbounds.map((p) => p.tag);
                expect(new Set(all).size).toBe(all.length);
            } else {
                expect(output).not.toMatch(/^DIRECT = trojan/m);
                expect(output).not.toMatch(/tag=DIRECT$/m);
                expect(output).not.toMatch(/name: "DIRECT"/m);
            }
        }
    );
    it('emits default only for selectors in sing-box template groups', () => {
        const config = JSON.parse(
            renderSingboxFromIniTemplate(getBuiltinTemplate('clash_misub_minimal').content, {
                nodeList: nodes,
                ruleLevel: 'std',
            })
        );
        const tests = config.outbounds.filter((outbound) => outbound.type === 'urltest');
        expect(tests.length).toBeGreaterThan(0);
        for (const outbound of tests) expect(outbound).not.toHaveProperty('default');
        expect(config.outbounds.find((outbound) => outbound.type === 'selector')).toHaveProperty(
            'default'
        );
    });
    it.each(Object.keys(BUILTIN_TEMPLATE_REGISTRY))(
        'defines every rule destination in builtin template %s',
        (id) => {
            const model = applySmartModelOptimizations(
                parseIniTemplate(getBuiltinTemplate(id).content, {
                    proxies: [
                        {
                            name: 'US-1',
                            type: 'trojan',
                            server: 'example.com',
                            port: 443,
                            password: 'synthetic',
                        },
                    ],
                })
            );
            const policies = new Set([
                'DIRECT',
                'REJECT',
                'REJECT-DROP',
                'US-1',
                ...model.groups.map((group) => group.name),
            ]);
            for (const rule of model.rules)
                expect(policies.has(rule.policy), `${id}: ${rule.policy}`).toBe(true);
        }
    );
    it('blocks a public upstream redirect to a private endpoint', async () => {
        const fetcher = vi.fn(
            async () =>
                new Response(null, {
                    status: 302,
                    headers: { Location: 'http://169.254.169.254/latest/meta-data/' },
                })
        );
        vi.stubGlobal('fetch', fetcher);
        await expect(
            fetchRemoteSourceSnapshot({ url: 'https://source.example/sub' })
        ).rejects.toThrow('URL host is not allowed');
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher.mock.calls[0][0].redirect).toBe('manual');
    });
    it('blocks a remote template redirect to loopback', async () => {
        const fetcher = vi.fn(
            async () =>
                new Response(null, {
                    status: 302,
                    headers: { Location: 'http://127.0.0.1/template' },
                })
        );
        vi.stubGlobal('fetch', fetcher);
        await expect(
            fetchTransformTemplate({ get: async () => null }, 'https://template.example/config')
        ).rejects.toThrow('URL host is not allowed');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
