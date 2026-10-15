import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { extractValidNodes } from '../functions/modules/utils/node-parser.js';
import { urlToClashProxy } from '../functions/utils/url-to-clash.js';
import { generateBuiltinClashConfig } from '../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSingboxConfig } from '../functions/modules/subscription/builtin-singbox-generator.js';

const vless =
    'vless://00000000-0000-4000-8000-000000000001@192.0.2.1:443?type=tcp&security=reality&sni=example.com&fp=chrome&pbk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&sid=0123456789abcdef&flow=xtls-rprx-vision#Fixture-VLESS-REALITY';
const nodes = [
    vless,
    'trojan://fixture-password@192.0.2.2:443?security=tls&sni=example.com#Fixture-Trojan',
    `ss://${Buffer.from('aes-128-gcm:fixture-password').toString('base64')}@192.0.2.3:8388#Fixture-SS`,
].join('\n');
const decoded = extractValidNodes(Buffer.from(nodes).toString('base64'));
assert.equal(decoded.filter((line) => line.startsWith('vless://')).length, 1);
const proxy = urlToClashProxy(vless);
assert.equal(proxy.servername, 'example.com');
assert.equal(proxy.flow, 'xtls-rprx-vision');
assert.equal(proxy.tls, true);
assert.equal(proxy['reality-opts']['public-key'], 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
assert.equal(proxy['reality-opts']['short-id'], '0123456789abcdef');
const directory = resolve(process.argv[2] || 'tmp/client-fixtures');
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'nodes.txt'), nodes);
await writeFile(resolve(directory, 'mihomo.yaml'), generateBuiltinClashConfig(nodes));
await writeFile(resolve(directory, 'singbox.json'), generateBuiltinSingboxConfig(nodes));
console.log(
    'Synthetic S-UI Base64, REALITY, Trojan and Shadowsocks fixtures generated; REALITY fields verified.'
);
