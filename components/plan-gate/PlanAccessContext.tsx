"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PlanAccess } from "@/lib/plan-access";

interface PlanAccessContextValue extends PlanAccess {
  profileId?: string;
}

const PlanAccessContext = createContext<PlanAccessContextValue | null>(null);

export function PlanAccessProvider({
  planAccess,
  profileId,
  children,
}: {
  planAccess: PlanAccess;
  profileId?: string;
  children: ReactNode;
}) {
  return (
    <PlanAccessContext.Provider value={{ ...planAccess, profileId }}>
      {children}
    </PlanAccessContext.Provider>
  );
}

export function usePlanAccess(): PlanAccessContextValue {
  const ctx = useContext(PlanAccessContext);
  if (!ctx) {
    return {
      hasPlan: false,
      soloAccess: false,
      virtualAccess: false,
      sessionAllowances: null,
      planName: null,
      sessionUsage: null,
    };
  }
  return ctx;
}
