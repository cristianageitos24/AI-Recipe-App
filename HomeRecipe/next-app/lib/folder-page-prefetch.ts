"use client";

import { getFolderPageData } from "@/app/actions/folders";

type FolderPageDataResult = Awaited<ReturnType<typeof getFolderPageData>>;

const CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 8;

type CacheEntry = {
  expiresAt: number;
  promise: Promise<FolderPageDataResult>;
  result?: FolderPageDataResult;
};

const folderPageDataCache = new Map<string, CacheEntry>();

function cacheKey(folderName: string) {
  return folderName.trim();
}

function pruneExpiredEntries(now = Date.now()) {
  for (const [key, entry] of folderPageDataCache) {
    if (entry.expiresAt <= now) folderPageDataCache.delete(key);
  }
}

function trimCacheToSize() {
  while (folderPageDataCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = folderPageDataCache.keys().next().value as string | undefined;
    if (oldestKey == null) return;
    folderPageDataCache.delete(oldestKey);
  }
}

export function prefetchFolderPageData(folderName: string) {
  const key = cacheKey(folderName);
  if (!key) return null;

  const now = Date.now();
  pruneExpiredEntries(now);

  const cached = folderPageDataCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const entry: CacheEntry = {
    expiresAt: now + CACHE_TTL_MS,
    promise: getFolderPageData(folderName),
  };

  entry.promise
    .then((result) => {
      entry.result = result;
      entry.expiresAt = Date.now() + CACHE_TTL_MS;
      return result;
    })
    .catch(() => {
      folderPageDataCache.delete(key);
    });

  folderPageDataCache.set(key, entry);
  trimCacheToSize();
  return entry.promise;
}

export function readFolderPageData(folderName: string) {
  const key = cacheKey(folderName);
  if (!key) return null;

  const now = Date.now();
  pruneExpiredEntries(now);

  const cached = folderPageDataCache.get(key);
  if (!cached || cached.expiresAt <= now) return null;
  return cached.result ? Promise.resolve(cached.result) : cached.promise;
}

export function invalidateFolderPageData(folderName: string) {
  const key = cacheKey(folderName);
  if (!key) return;
  folderPageDataCache.delete(key);
}
