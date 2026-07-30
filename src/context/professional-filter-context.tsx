import React, { createContext, useContext, useMemo, useState } from "react";

export type ProfessionalFilters = {
  q?: string;
  cpf?: string;
  matricula?: string;
  unidadeId?: string | null;
  setorId?: string | null;
  cargoId?: string | null;
  funcaoId?: string | null;
  vinculoId?: string | null;
  status?: string | null;
  perfil?: string | null;
};

type ContextValue = {
  filters: ProfessionalFilters;
  setFilters: (v: Partial<ProfessionalFilters>) => void;
  reset: () => void;
};

const ProfessionalFilterContext = createContext<ContextValue | undefined>(undefined);

export const ProfessionalFilterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [filters, setFiltersState] = useState<ProfessionalFilters>({});

  const setFilters = (v: Partial<ProfessionalFilters>) =>
    setFiltersState((prev) => ({ ...prev, ...v }));
  const reset = () => setFiltersState({});

  const value = useMemo(() => ({ filters, setFilters, reset }), [filters]);

  return (
    <ProfessionalFilterContext.Provider value={value}>
      {children}
    </ProfessionalFilterContext.Provider>
  );
};

export function useProfessionalFilters() {
  const ctx = useContext(ProfessionalFilterContext);
  if (!ctx)
    throw new Error("useProfessionalFilters must be used within ProfessionalFilterProvider");
  return ctx;
}
