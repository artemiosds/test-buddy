import React from "react";

export type AnalyticsFilterState = {
  competenciaId?: string | null;
  secretariaId?: string | null;
  unidadeId?: string | null;
  setorId?: string | null;
  cargoId?: string | null;
  funcaoId?: string | null;
  vinculoId?: string | null;
  status?: string | null;
  setFilters?: (f: Partial<AnalyticsFilterState>) => void;
};

export const AnalyticsFilterContext = React.createContext<AnalyticsFilterState>({});

export function AnalyticsFilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AnalyticsFilterState>({});
  const setFilters = (f: Partial<AnalyticsFilterState>) => setState((s) => ({ ...s, ...f }));
  return (
    <AnalyticsFilterContext.Provider value={{ ...state, setFilters }}>
      {children}
    </AnalyticsFilterContext.Provider>
  );
}
