"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMyEntitlements } from "@/app/actions/entitlements";
import { FREE_EXTRACTION_LIMIT, FREE_RECIPE_TTL_DAYS } from "@/lib/entitlements-constants";

export type ClientEntitlements = {
  isPro: boolean;
  extractionsUsed: number;
  extractionsLimit: number;
  extractionsRemaining: number;
  recipeTtlDays: number;
};

type EntitlementsContextValue = {
  entitlements: ClientEntitlements;
  loading: boolean;
  refreshEntitlements: () => Promise<void>;
};

const defaultEntitlements: ClientEntitlements = {
  isPro: false,
  extractionsUsed: 0,
  extractionsLimit: FREE_EXTRACTION_LIMIT,
  extractionsRemaining: FREE_EXTRACTION_LIMIT,
  recipeTtlDays: FREE_RECIPE_TTL_DAYS,
};

const EntitlementsContext = createContext<EntitlementsContextValue>({
  entitlements: defaultEntitlements,
  loading: true,
  refreshEntitlements: async () => {},
});

export function EntitlementsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: ClientEntitlements | null;
}) {
  const [entitlements, setEntitlements] = useState<ClientEntitlements>(
    initial ?? defaultEntitlements
  );
  const [loading, setLoading] = useState(!initial);

  const refreshEntitlements = useCallback(async () => {
    const res = await getMyEntitlements();
    if (res.data) {
      setEntitlements(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initial) {
      void refreshEntitlements();
    }
  }, [initial, refreshEntitlements]);

  return (
    <EntitlementsContext.Provider
      value={{ entitlements, loading, refreshEntitlements }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  return useContext(EntitlementsContext);
}
