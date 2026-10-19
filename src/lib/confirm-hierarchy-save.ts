type SavedHierarchy = { id: string; codigo_hierarquico: string | null };

export function confirmHierarchySave(
  saved: SavedHierarchy | null,
  expectedCode: string | null,
  expectedId?: string,
): void {
  if (!saved || (expectedId && saved.id !== expectedId)) {
    throw new Error("Nenhum registro foi salvo. Verifique sua permissão para gerenciar esta unidade.");
  }
  if (saved.codigo_hierarquico !== expectedCode) {
    throw new Error("O código hierárquico não foi confirmado. Reabra o cadastro antes de tentar novamente.");
  }
}