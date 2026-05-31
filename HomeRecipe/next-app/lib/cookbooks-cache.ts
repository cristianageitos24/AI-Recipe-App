"use client";

import { getFolders, type GetFoldersData } from "@/app/actions/folders";
import { getCookbookBootstrap } from "@/app/actions/dashboard";

type CookbooksDataResult = Awaited<ReturnType<typeof getFolders>>;
type CookbookBootstrapResult = Awaited<ReturnType<typeof getCookbookBootstrap>>;

const CACHE_TTL_MS = 2 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  promise: Promise<CookbooksDataResult>;
  result?: CookbooksDataResult;
};

let cookbooksDataCache: CacheEntry | null = null;
let cookbookBootstrapPromise: Promise<CookbookBootstrapResult> | null = null;

export function readCookbooksData() {
  const entry = cookbooksDataCache;
  if (entry == null || entry.expiresAt <= Date.now()) {
    cookbooksDataCache = null;
    return null;
  }
  return entry.result ? Promise.resolve(entry.result) : entry.promise;
}

export function fetchCookbooksData() {
  const cached = readCookbooksData();
  if (cached) return cached;

  const entry: CacheEntry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise: getFolders(),
  };

  entry.promise
    .then((result) => {
      entry.result = result;
      entry.expiresAt = Date.now() + CACHE_TTL_MS;
      return result;
    })
    .catch(() => {
      if (cookbooksDataCache === entry) cookbooksDataCache = null;
    });

  cookbooksDataCache = entry;
  return entry.promise;
}

export function fetchCookbookBootstrapData() {
  if (cookbookBootstrapPromise) return cookbookBootstrapPromise;

  cookbookBootstrapPromise = getCookbookBootstrap().finally(() => {
    cookbookBootstrapPromise = null;
  });

  return cookbookBootstrapPromise;
}

export function primeCookbooksData(data: Partial<GetFoldersData> & Pick<GetFoldersData, "folders" | "results">) {
  const currentData = cookbooksDataCache?.result?.data;
  const nextData: GetFoldersData = {
    folders: data.folders,
    results: data.results,
    folderIdsByName: data.folderIdsByName ?? currentData?.folderIdsByName ?? {},
    folderCovers: data.folderCovers ?? currentData?.folderCovers ?? {},
  };
  const result: CookbooksDataResult = { error: null, data: nextData };
  cookbooksDataCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise: Promise.resolve(result),
    result,
  };
}

export function invalidateCookbooksData() {
  cookbooksDataCache = null;
}
