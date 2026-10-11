/** Reserve original names and every emitted suffix in the same namespace. */
export function getUniqueName(baseName, usedNames) {
    let suffix = usedNames.get(baseName) || 0;
    let name = suffix ? `${baseName}_${suffix}` : baseName;
    while (usedNames.has(name)) name = `${baseName}_${++suffix}`;
    usedNames.set(baseName, suffix + 1);
    usedNames.set(name, 1);
    return name;
}
