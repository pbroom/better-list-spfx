import type { IconifyIcon } from '@iconify/react/offline';

import { BetterListGroupIconLibrary } from '../../../shared';
import {
  getGeneratedGroupIconShardLoaders,
  loadGeneratedGroupIconManifest
} from './generated/group-icons/loaders';

export interface IBetterListGroupIconManifestEntry {
  name: string;
  label: string;
  searchText: string;
  shard: number;
}

const manifestCache: Partial<Record<BetterListGroupIconLibrary, Promise<readonly IBetterListGroupIconManifestEntry[]>>> = {};
const shardCache = new Map<string, Promise<Readonly<Record<string, IconifyIcon>>>>();

export function loadBetterListGroupIconManifest(
  library: BetterListGroupIconLibrary
): Promise<readonly IBetterListGroupIconManifestEntry[]> {
  const cached = manifestCache[library];
  if (cached) {
    return cached;
  }
  const request = loadGeneratedGroupIconManifest(library)
    .then((module) => module.default as readonly IBetterListGroupIconManifestEntry[])
    .catch((error) => {
      delete manifestCache[library];
      throw error;
    });
  manifestCache[library] = request;
  return request;
}

export function loadBetterListGroupIconData(
  library: BetterListGroupIconLibrary,
  name: string
): Promise<IconifyIcon | undefined> {
  const shard = getBetterListGroupIconShard(name);
  const cacheKey = `${library}:${shard}`;
  let request = shardCache.get(cacheKey);
  if (!request) {
    const loader = getGeneratedGroupIconShardLoaders(library)[shard];
    request = loader()
      .then((module) => module.default as Readonly<Record<string, IconifyIcon>>)
      .catch((error) => {
        shardCache.delete(cacheKey);
        throw error;
      });
    shardCache.set(cacheKey, request);
  }
  return request.then((icons) => icons[name]);
}

export function getBetterListGroupIconShard(name: string): number {
  const firstLetter = name.charCodeAt(0) - 97;
  return Math.max(0, Math.min(15, Math.floor(firstLetter * 16 / 26)));
}
