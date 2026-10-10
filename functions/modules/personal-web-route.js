// Personal deployment: only / serves a web document. API, token downloads and
// genuine static resources keep their existing handlers and access controls.
export function isPersonalAssetPath(pathname) {
    if (pathname === '/index.html' || pathname.endsWith('/index.html')) return false;
    if (pathname.startsWith('/cdn-cgi/')) return true;
    if (/^\/(assets|icons|fonts)\//.test(pathname)) return true;
    return /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|webmanifest|txt|json)$/i.test(pathname);
}

export function classifyPersonalRequest(pathname, { mytoken, profileToken } = {}) {
    if (pathname === '/') return 'root';
    if (pathname.startsWith('/api/') || pathname.startsWith('/sub/') || pathname === '/cron') {
        return 'business';
    }
    const firstSegment = pathname.split('/').filter(Boolean)[0];
    if (firstSegment && (firstSegment === mytoken || firstSegment === profileToken)) {
        return 'business';
    }
    if (isPersonalAssetPath(pathname)) return 'asset';
    return 'forbidden';
}
