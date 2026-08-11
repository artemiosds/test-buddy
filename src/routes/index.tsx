import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { 
  Users, 
  Building2, 
  FileCheck, 
  ShieldCheck, 
  BarChart3, 
  Settings2,
  Clock
} from 'lucide-react';

export const Route = createFileRoute('/')({
  component: Dashboard,
  head: () => ({
    title: 'Gestão da Saúde | Oriximiná',
    meta: [
      { name: 'description', content: 'Painel administrativo da Secretaria Municipal de Saúde de Oriximiná' },
      { property: 'og:title', content: 'Gestão da Saúde | Oriximiná' },
      { property: 'og:description', content: 'Painel administrativo da Secretaria Municipal de Saúde de Oriximiná' },
      { name: 'twitter:card', content: 'summary_large_image' }
    ]
  })
});

function Dashboard() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-[#0f172a]">Gestão da Saúde</h2>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link to="/relatorio-inteligente">Gerar Relatórios</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total de Profissionais</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">19</div>
            <p className="text-xs text-muted-foreground">CER Oriximiná</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Unidades de Saúde</CardTitle>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Ativas no sistema</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Frequências Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Mês vigente</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Assinaturas Digitais</CardTitle>
            <FileCheck className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ativa</div>
            <p className="text-xs text-muted-foreground">Módulo institucional OK</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Auditoria de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">Motor RBAC Stabilizado: APROVADO PARA PRODUÇÃO</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="text-sm font-semibold mb-2 text-slate-900">MASTER BYPASS</h4>
                  <p className="text-xs text-slate-600 italic">Centralized Source of Truth (is_master_db)</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="text-sm font-semibold mb-2 text-slate-900">ISOLAMENTO TERRITORIAL</h4>
                  <p className="text-xs text-slate-600 italic">Enforced for non-master profiles</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-sm bg-white text-white bg-slate-900">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="secondary" className="w-full justify-start gap-2" asChild>
              <Link to="/profissionais">
                <Users className="h-4 w-4" />
                Gerenciar Profissionais
              </Link>
            </Button>
            <Button variant="secondary" className="w-full justify-start gap-2" asChild>
              <Link to="/assinaturas">
                <FileCheck className="h-4 w-4" />
                Minhas Assinaturas
              </Link>
            </Button>
            <Button variant="secondary" className="w-full justify-start gap-2" asChild>
              <Link to="/piso-enfermagem">
                <Building2 className="h-4 w-4" />
                Piso da Enfermagem
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
