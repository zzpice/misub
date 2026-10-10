// Deployment policy for this independently maintained personal instance.
// Cloudflare Secrets remain authoritative even after settings restore/reset.
export function isPersonalMode(env) {
    return String(env?.MISUB_PERSONAL_MODE).toLowerCase() === 'true';
}

export function applyPersonalSettings(settings = {}, env = {}) {
    if (!isPersonalMode(env)) return settings;
    const values = [
        env.ADMIN_PASSWORD,
        env.COOKIE_SECRET,
        env.SUBSCRIPTION_TOKEN,
        env.PROFILE_TOKEN,
    ];
    if (
        values.some((value) => typeof value !== 'string' || value.length < 32) ||
        new Set(values).size !== values.length
    ) {
        throw new Error('Personal deployment requires four independent configured Secrets');
    }
    return {
        ...settings,
        storageType: 'd1',
        mytoken: env.SUBSCRIPTION_TOKEN,
        profileToken: env.PROFILE_TOKEN,
        enableAccessLog: false,
        enableEnhancedLogging: false,
        externalApi: { ...settings.externalApi, enabled: false },
        subconverter: { ...settings.subconverter, engineMode: 'builtin' },
    };
}
