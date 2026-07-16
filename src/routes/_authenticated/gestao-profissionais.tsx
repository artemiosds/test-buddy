import { createFileRoute } from '@tanstack/react-router';
import { ProfessionalFilterProvider } from '@/context/professional-filter-context';
import ProfessionalsPage from '@/components/profissionais/ProfessionalsPage';

export const Route = createFileRoute('/_authenticated/gestao-profissionais')({
  component: () => (
    <ProfessionalFilterProvider>
      <ProfessionalsPage />
    </ProfessionalFilterProvider>
  ),
});