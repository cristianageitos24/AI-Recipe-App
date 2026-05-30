"use client";

import { useEffect, useCallback, useState } from "react";
import { getFolders } from "@/app/actions/folders";
import { CookbookCreateCard } from "./CookbookCreateCard";
import { CookbookLoadingRow } from "./CookbookLoadingRow";
import { FolderTemplate } from "./FolderTemplate";
import "@/app/styling/Cookbooks.css";

type FolderWithLength = {
  folderId: string;
  folderName: string;
  folderLength: number;
  coverImageUrl: string | null;
};

function getFolderAndLengths(data: {
  folders?: string[];
  folderIdsByName?: Record<string, string>;
  results?: Record<string, unknown[]>;
  folderCovers?: Record<string, string | null>;
}): FolderWithLength[] {
  const folders = data.folders ?? [];
  const ids = data.folderIdsByName ?? {};
  const results = data.results ?? {};
  const covers = data.folderCovers ?? {};
  return folders.map((name) => ({
    folderId: ids[name] ?? "",
    folderName: name,
    folderLength: (results[name] ?? []).length,
    coverImageUrl: covers[name] ?? null,
  }));
}

type CookbooksProps = {
  initialFoldersData?: {
    folders: string[];
    folderIdsByName?: Record<string, string>;
    results: Record<string, unknown[]>;
    folderCovers?: Record<string, string | null>;
  } | null;
};

export function Cookbooks({ initialFoldersData }: CookbooksProps = {}) {
  /** `null` = not loaded from client fetch yet; use bootstrap `initialFoldersData` when present. */
  const [fetchedFolders, setFetchedFolders] = useState<FolderWithLength[] | null>(null);
  const isLoadingFolders = fetchedFolders === null && initialFoldersData == null;
  const folders =
    fetchedFolders !== null
      ? fetchedFolders
      : initialFoldersData != null
        ? getFolderAndLengths(initialFoldersData)
        : [];

  const fetchFolders = useCallback(async () => {
    const res = await getFolders();
    if (res.data) setFetchedFolders(getFolderAndLengths(res.data));
  }, []);

  /** Always refresh from the server on mount so a stale bootstrap (e.g. empty folders[]) never skips loading. */
  useEffect(() => {
    let isCurrent = true;
    getFolders().then((res) => {
      if (isCurrent && res.data) setFetchedFolders(getFolderAndLengths(res.data));
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <div className="tabcookbook-cookbooks-section">
      <div className="cookbook-section-header">
        <div className="cookbook-section-title-wrap">
          <h1 className="cookbook-subtitle">Your Cookbooks</h1>
          {isLoadingFolders ? (
            <span className="cookbook-count-badge cookbook-count-badge-skeleton" aria-hidden="true" />
          ) : (
            <span className="cookbook-count-badge">{folders.length}</span>
          )}
        </div>
        <button
          type="button"
          className="cookbook-header-add-btn"
          onClick={() => document.querySelector<HTMLButtonElement>(".cookbook-create-card")?.click()}
        >
          + New Cookbook
        </button>
      </div>
      {isLoadingFolders ? (
        <CookbookLoadingRow createCard={<CookbookCreateCard onCreated={fetchFolders} />} />
      ) : (
        <div className="cookbook-folders-content-container" aria-busy="false">
          {folders.map((folder) => (
            <FolderTemplate
              key={folder.folderId || folder.folderName}
              folderData={folder}
              onUpdate={fetchFolders}
            />
          ))}
          <CookbookCreateCard onCreated={fetchFolders} />
        </div>
      )}
    </div>
  );
}
