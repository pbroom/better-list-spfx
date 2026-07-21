import { getBetterListGroupIconShard, loadBetterListGroupIconData, loadBetterListGroupIconManifest } from './GroupIconDataLoader';

describe('group icon data loader', () => {
  it('loads each generated picker family without combining the collections', async () => {
    const [solar, fluent, color] = await Promise.all([
      loadBetterListGroupIconManifest('solar-duotone'),
      loadBetterListGroupIconManifest('fluent'),
      loadBetterListGroupIconManifest('fluent-color')
    ]);

    expect(solar.length).toBeGreaterThan(1000);
    expect(fluent.length).toBeGreaterThan(3000);
    expect(color.length).toBeGreaterThan(150);
    expect(solar.every((entry) => entry.name.endsWith('-bold-duotone'))).toBe(true);
    expect(fluent.every((entry) => entry.name.endsWith('-regular'))).toBe(true);
  });

  it('resolves icon data from the deterministic shard used by persisted icons', async () => {
    const name = 'accessibility-24-regular';
    const manifest = await loadBetterListGroupIconManifest('fluent');
    const entry = manifest.find((candidate) => candidate.name === name);

    expect(entry?.shard).toBe(getBetterListGroupIconShard(name));
    expect(await loadBetterListGroupIconData('fluent', name)).toMatchObject({ body: expect.any(String) });
    expect(await loadBetterListGroupIconData('fluent', 'missing-24-regular')).toBeUndefined();
  });
});
