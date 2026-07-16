import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      // Durações por tipo (ms): success 3s, error 6s, warning 5s, info 4s
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast font-sans text-sm rounded-lg border shadow-lg " +
            "group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border-strong",
          title: "font-semibold",
          description: "text-muted-foreground text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Tipos semânticos alinhados aos tokens de estado
          success:
            "group-[.toaster]:bg-success-soft group-[.toaster]:text-success-soft-foreground group-[.toaster]:border-success/40",
          error:
            "group-[.toaster]:bg-danger-soft group-[.toaster]:text-danger-soft-foreground group-[.toaster]:border-destructive/40",
          warning:
            "group-[.toaster]:bg-warning-soft group-[.toaster]:text-warning-soft-foreground group-[.toaster]:border-warning/40",
          info:
            "group-[.toaster]:bg-info-soft group-[.toaster]:text-info-soft-foreground group-[.toaster]:border-info/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
