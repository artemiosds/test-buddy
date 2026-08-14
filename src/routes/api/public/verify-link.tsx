import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/api/public/verify-link")({
  component: () => (
    <div className="p-10">
      <a
        id="test-chat-ia-link"
        href="https://gemini.google.com/spark/chat/efafafc04fd74247?utm_source=app_launcher&utm_medium=owned&utm_campaign=base_all"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium cursor-pointer transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-8 px-3"
        aria-label="Abrir chat de IA em nova aba"
      >
        <Sparkles className="mr-2 h-4 w-4" /> Chat IA
      </a>
    </div>
  ),
});
