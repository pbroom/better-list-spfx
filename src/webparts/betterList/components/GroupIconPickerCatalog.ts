import { BetterListGroupIconLibrary } from '../../../shared';
import {
  IBetterListGroupIconManifestEntry,
  loadBetterListGroupIconManifest
} from './GroupIconDataLoader';

export interface IBetterListGroupIconCatalogEntry {
  library: BetterListGroupIconLibrary;
  name: string;
  label: string;
  searchText: string;
  shard: number;
}

export async function loadBetterListGroupIconPickerCatalog(
  library: BetterListGroupIconLibrary
): Promise<readonly IBetterListGroupIconCatalogEntry[]> {
  const manifest = await loadBetterListGroupIconManifest(library);
  return manifest.map((entry: IBetterListGroupIconManifestEntry) => ({ ...entry, library }));
}
