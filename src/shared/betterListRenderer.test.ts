import { getBetterListRenderer } from './betterListRenderer';

describe('Better List Griffel renderer', () => {
  it('uses a stable application salt and caches one renderer per document', () => {
    const first = getBetterListRenderer(document);
    const second = getBetterListRenderer(document);

    expect(first).toBe(second);
    expect(first.classNameHashSalt).toBe('better-list-spfx');
    expect(first.styleElementAttributes).toEqual({ 'data-better-list-griffel': '' });
  });
});
