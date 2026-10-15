// Reproducible offline audit fixtures. Never read production nodes or Cloudflare data.
// Usage: node scripts/audit-client-configs.mjs <output-dir> <mihomo-path> <sing-box-path>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { transformBuiltinSubscription } from '../functions/modules/subscription/transformer-factory.js';
import { BUILTIN_TEMPLATE_REGISTRY } from '../functions/modules/subscription/builtin-template-registry.js';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../functions/modules/subscription/template-pipeline.js';
import { nodeRegionIdentity } from '../functions/services/region-preferences.js';

const directory = resolve(process.argv[2] || '/tmp/misub-audit-configs');
await mkdir(directory, { recursive: true });
const names = ['A', 'A', 'A_1', 'DIRECT', 'REJECT', '🚀 节点选择', 'JP-1', '🔗 链式代理 - A'];
const urls = names.map(
    (name, i) =>
        `trojan://synthetic-${i}@192.0.2.${i + 10}:443?security=tls&sni=example.com#${encodeURIComponent(name)}`
);
urls.push(
    'vless://00000000-0000-4000-8000-000000000001@192.0.2.1:443?type=tcp&security=reality&sni=example.com&fp=chrome&pbk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&sid=0123456789abcdef&flow=xtls-rprx-vision#Fixture-REALITY'
);
urls.push(
    `ss://${Buffer.from('aes-128-gcm:synthetic').toString('base64')}@192.0.2.2:8388#Fixture-SS`
);
const nodes = urls.join('\n');
const sourceRegionHints = new Map([[nodeRegionIdentity(urls[6]), { manualRegion: '美国' }]]);
const mihomo = process.argv[3];
const singbox = process.argv[4];
assert.ok(
    Boolean(mihomo) === Boolean(singbox),
    'Supply both client binaries, or neither to generate only'
);
let count = 0;
async function verify(name, format, content) {
    const filename = resolve(directory, `${name}.${format === 'clash' ? 'yaml' : 'json'}`);
    await writeFile(filename, content);
    const config = format === 'clash' ? yaml.load(content) : JSON.parse(content);
    const tags =
        format === 'clash'
            ? [
                  ...config.proxies.map((proxy) => proxy.name),
                  ...config['proxy-groups'].map((group) => group.name),
                  'DIRECT',
                  'REJECT',
              ]
            : config.outbounds.map((outbound) => outbound.tag);
    assert.equal(new Set(tags).size, tags.length, `${name}: duplicate proxy/policy name`);
    const binary = format === 'clash' ? mihomo : singbox;
    if (binary) {
        const args =
            format === 'clash'
                ? ['-t', '-d', directory, '-f', filename]
                : ['check', '-c', filename];
        const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 45000 });
        assert.equal(
            result.status,
            0,
            `${name}: ${result.error?.message || ''}\n${result.stdout}\n${result.stderr}`
        );
    }
    count++;
    console.log(`${binary ? 'validated' : 'generated'} ${name}`);
}
for (const dnsMode of ['clean', 'polluted']) {
    for (const ruleLevel of ['base', 'std', 'full', 'relay']) {
        for (const format of ['clash', 'singbox']) {
            await verify(
                `builtin-${format}-${ruleLevel}-${dnsMode}`,
                format,
                transformBuiltinSubscription(nodes, format, {
                    ruleLevel,
                    dnsMode,
                    addFlagEmoji: false,
                    isMeta: true,
                    regionsAlreadyResolved: true,
                    sourceRegionHints,
                })
            );
        }
    }
    for (const [id, template] of Object.entries(BUILTIN_TEMPLATE_REGISTRY)) {
        for (const format of ['clash', 'singbox']) {
            const renderer =
                format === 'clash' ? renderClashFromIniTemplate : renderSingboxFromIniTemplate;
            await verify(
                `${id}-${format}-${dnsMode}`,
                format,
                renderer(template.content, {
                    nodeList: nodes,
                    ruleLevel: 'std',
                    dnsMode,
                    addFlagEmoji: false,
                    isMeta: true,
                    sourceRegionHints,
                })
            );
        }
    }
}
console.log(
    `${count} complete synthetic configurations ${mihomo ? 'validated with actual clients' : 'generated'}.`
);
