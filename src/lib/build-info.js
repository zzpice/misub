import packageJson from '../../package.json';

export const currentVersion = packageJson.version;
export const buildCommit =
    typeof __ZZP_SUB_BUILD_COMMIT__ === 'string' ? __ZZP_SUB_BUILD_COMMIT__ : '';
