import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class EditorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[EditorErrorBoundary] Fallback acionado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-destructive/5 text-destructive space-y-4 min-h-[200px]">
          <AlertCircle className="h-10 w-10 opacity-50" />
          <div className="text-center">
            <h3 className="font-semibold text-sm">Não foi possível carregar o editor</h3>
            <p className="text-xs opacity-80 mt-1 max-w-[250px]">
              Ocorreu um erro estrutural ao inicializar o Tiptap.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCcw className="h-3 w-3" />
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
