import packageJson from '../../package.json';

export const currentVersion = packageJson.version;
export const buildCommit = typeof __MISUB_BUILD_COMMIT__ === 'string' ? __MISUB_BUILD_COMMIT__ : '';
