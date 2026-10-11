import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('independent MiSub · zzpice brand and version invariants', () => {
    it('uses its own version consistently without rewriting the upstream provenance', () => {
        const pkg = JSON.parse(read('package.json'));
        const lock = JSON.parse(read('package-lock.json'));
        expect(pkg.version).toBe('1.0.0');
        expect(lock.version).toBe(pkg.version);
        expect(lock.packages[''].version).toBe(pkg.version);
        expect(read('functions/modules/config.js')).toContain("VERSION: '1.0.0'");
        expect(read('src/lib/build-info.js')).toContain('packageJson.version');
        expect(read('NOTICE.md')).toContain('imzyb/MiSub');
        expect(read('NOTICE.md')).toContain('upstream v2.7.0');
        expect(read('LICENSE')).toContain('Copyright (c) 2026 MiSub Contributors');
    });

    it('shares the same brand in browser metadata, dynamic titles and footer', () => {
        expect(read('index.html')).toContain('<title>MiSub · zzpice</title>');
        expect(read('index.html')).toContain('href="/brand.svg"');
        expect(read('src/App.vue')).toContain('BRAND_TITLE');
        expect(read('src/router/index.js')).toContain('BRAND_TITLE');
        expect(read('src/components/layout/Footer.vue')).toContain('BRAND_MAINTAINER');
        expect(read('src/components/layout/BrandLogo.vue')).toContain('BrandMark');
        expect(read('src/components/modals/Login.vue')).toContain('BrandMark');
        expect(read('public/brand.svg')).toContain('MiSub · zzpice');
    });

    it('keeps brand assets fingerprint-protected when a disguise is enabled', () => {
        const edge = read('functions/[[path]].js');
        expect(edge).toContain("url.pathname === '/brand.svg'");
        expect(edge).toContain("url.pathname === '/logo.png'");
        expect(edge).toContain("const isAuthenticated = await authMiddleware(request, env)");
    });
});
