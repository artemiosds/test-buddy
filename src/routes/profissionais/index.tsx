import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ProfessionalFilterProvider } from '@/context/professional-filter-context';
import ProfessionalsPage from '@/components/profissionais/ProfessionalsPage';

export const Route = createFileRoute('/profissionais/')({
  component: () => (
    <ProfessionalFilterProvider>
      <ProfessionalsPage />
    </ProfessionalFilterProvider>
  ),
});

export default Route;
