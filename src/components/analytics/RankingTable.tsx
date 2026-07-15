import React from "react";
import { Card } from "@/components/ui/card";

export function RankingTable({ prepared }: { prepared?: { ranking?: any } }) {
  return (
    <Card className="p-3 mt-4">
      <h3 className="text-lg font-semibold">Ranking das Unidades</h3>
      {prepared?.ranking?.prepared ? (
        <div className="text-sm text-muted-foreground mt-2">Preparado para implementação — requer agregações por unidade (view/RPC).</div>
      ) : (
        <div>—</div>
      )}
    </Card>
  );
}
