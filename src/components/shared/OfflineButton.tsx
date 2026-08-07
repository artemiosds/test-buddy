import { Button, ButtonProps } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/use-network-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { forwardRef } from "react";

interface OfflineButtonProps extends ButtonProps {
  requireOnline?: boolean;
}

export const OfflineButton = forwardRef<HTMLButtonElement, OfflineButtonProps>(
  ({ requireOnline = false, disabled, children, ...props }, ref) => {
    const { isOnline } = useNetworkStatus();
    const isEffectivelyDisabled = disabled || (requireOnline && !isOnline);

    if (requireOnline && !isOnline) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-block cursor-not-allowed">
                <Button
                  {...props}
                  ref={ref}
                  disabled={true}
                  className="pointer-events-none opacity-50"
                >
                  {children}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ações de alteração estão bloqueadas no modo offline.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button {...props} ref={ref} disabled={isEffectivelyDisabled}>
        {children}
      </Button>
    );
  }
);

OfflineButton.displayName = "OfflineButton";
