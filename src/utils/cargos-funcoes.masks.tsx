import { AlertCircle } from "lucide-react";

/**
 * Máscara para CBO (Cadastro Brasileiro de Ocupações)
 * Formato: "999.999" (6 dígitos com ponto no meio)
 */
export const maskCBO = (value: string): string => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .slice(0, 7); // Limita em 6 dígitos + 1 ponto
};

/**
 * Máscara para Gratificação Percentual
 * Garante que o valor esteja entre 0 e 100
 */
export const maskGratificacao = (value: string): string => {
  if (!value) return "";
  
  // Limpa caracteres não numéricos, permitindo ponto e vírgula
  let cleanValue = value.replace(/[^\d.,]/g, "").replace(",", ".");
  let num = parseFloat(cleanValue);
  
  if (isNaN(num)) return "";
  
  // Cap em 100%
  const cappedNum = Math.min(num, 100);
  
  return cappedNum.toString();
};

/**
 * Componente de erro reutilizável para formulários
 */
export function FormError({ field, errors }: { field: string; errors: Record<string, any> }) {
  if (!errors || !errors[field]) return null;
  
  return (
    <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
      <AlertCircle size={14} />
      <span>{errors[field].message}</span>
    </div>
  );
}
