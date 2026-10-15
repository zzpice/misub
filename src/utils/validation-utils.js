import { t } from '../i18n/index.js';

export function isValidUrl(value) {
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

/** Validation used by the profile editor; builtin/local templates are not remote URLs. */
export function validateProfile(profile) {
    const errors = {};
    if (!String(profile.name || '').trim()) errors.name = [t('validation.profileNameRequired')];
    else if (profile.name.length > 100) errors.name = [t('validation.maxLength', { count: 100 })];
    if (String(profile.customId || '').length > 50)
        errors.customId = [t('validation.maxLength', { count: 50 })];
    const template = String(profile.transformConfig || '').trim();
    if (template) {
        const prefix = ['builtin:', 'custom:'].find((p) => template.startsWith(p));
        if (prefix && !template.slice(prefix.length).trim())
            errors.transformConfig = [`${prefix} ${t('validation.templateNameEmpty')}`];
        else if (!prefix && !isValidUrl(template))
            errors.transformConfig = [t('validation.invalidTransformUrl')];
    }
    return { isValid: Object.keys(errors).length === 0, errors };
}
