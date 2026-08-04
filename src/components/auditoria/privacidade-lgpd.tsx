/**
 * Matriz de Privacidade e Máscara LGPD + explicação do certificado de fé pública.
 */
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, FileCheck2, ShieldCheck } from "lucide-react";
import { MATRIZ_PRIVACIDADE, maskCpf, type NivelPrivacidade } from "@/lib/lgpd";

export function PrivacidadeLgpd({
  nivel,
  usuario,
}: {
  nivel: NivelPrivacidade;
  usuario: { nome: string; identificador: string };
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-2">
          {nivel === "completo" ? (
            <Eye className="mt-0.5 h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <h3 className="text-sm font-semibold">
              Seu nível de acesso a dados pessoais:{" "}
              <Badge variant={nivel === "completo" ? "default" : "secondary"}>
                {nivel === "completo" ? "Completo (Master/Gestor)" : "Mascarado (Operacional/Fiscal)"}
              </Badge>
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {nivel === "completo"
                ? `Exportações em PDF recebem marca d'água dinâmica com ${usuario.nome} · ${usuario.identificador} · data/hora · IP.`
                : `CPFs são exibidos mascarados (ex.: ${maskCpf("12345678901")}) e dados bancários permanecem ocultos.`}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Perfil</th>
                <th className="px-3 py-2">CPF</th>
                <th className="px-3 py-2">Dados bancários</th>
                <th className="px-3 py-2">Marca d&apos;água no PDF</th>
              </tr>
            </thead>
            <tbody>
              {MATRIZ_PRIVACIDADE.map((m) => (
                <tr key={m.perfil} className="border-t">
                  <td className="px-3 py-2 font-medium">{m.perfil}</td>
                  <td className="px-3 py-2">{m.cpf}</td>
                  <td className="px-3 py-2">{m.bancario}</td>
                  <td className="px-3 py-2">{m.marcaDagua}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Item
          icone={<FileCheck2 className="h-4 w-4 text-primary" />}
          titulo="Certificado de autenticidade"
          texto="Toda exportação (PDF/XLSX/CSV) recebe um hash SHA-256 do conteúdo e um QR Code de verificação rápida da fé pública do documento."
        />
        <Item
          icone={<ShieldCheck className="h-4 w-4 text-primary" />}
          titulo="Log de downloads e extrações"
          texto="Cada download é gravado em audit_log com usuário, relatório, filtros aplicados, hash gerado, IP e horário."
        />
      </div>
    </div>
  );
}

function Item({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icone}</span>
        <div>
          <h4 className="text-sm font-semibold">{titulo}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{texto}</p>
        </div>
      </div>
    </div>
  );
}
