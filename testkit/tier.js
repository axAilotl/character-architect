export function getTestTier() {
    if (process.env.CF_RUN_LARGE_TESTS === '1')
        return 'large';
    const raw = (process.env.CF_TEST_TIER || 'basic').toLowerCase();
    if (raw === 'large')
        return 'large';
    if (raw === 'extended')
        return 'extended';
    return 'basic';
}
export function getFixtureTiersToRun() {
    const tier = getTestTier();
    if (tier === 'large')
        return ['basic', 'extended', 'synthetic', 'large'];
    if (tier === 'extended')
        return ['basic', 'extended', 'synthetic'];
    return ['basic', 'synthetic'];
}
//# sourceMappingURL=tier.js.map