import { createFileRoute } from "@tanstack/react-router";
import { DashboardClassico } from "@/components/dashboard/DashboardClassico";

export const Route = createFileRoute("/")({
  component: DashboardClassico,
});
