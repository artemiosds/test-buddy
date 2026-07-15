// Adapters: transform raw query results into view models for components

export function adaptKpiNumber(value: number | null | undefined) {
  return typeof value === "number" ? value : 0;
}

export function adaptPrepared(reason: string) {
  return { prepared: true, reason };
}
