import { lazy, Suspense, useState, useEffect } from 'react';
import { ClientOnly } from '@/components/shared/ClientOnly';
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { EditorLoading } from './EditorLoading';

const LazyRichTextEditor = lazy(() => import('../RichTextEditor').then(m => ({ default: m.RichTextEditor })));

interface AsyncEditorProps {
  content: string;
  onChange: (html: string) => void;
  dialogOpen: boolean;
}

/**
 * Componente de isolamento arquitetural para o RichTextEditor.
 * Garante que o editor só seja montado após a abertura completa do Dialog.
 */
export function AsyncRichTextEditor({ content, onChange, dialogOpen }: AsyncEditorProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (dialogOpen) {
      // Aguarda 300ms para garantir que a animação do Radix UI Dialog terminou
      // e o portal está estável no DOM antes de injetar o Tiptap.
      timeout = setTimeout(() => {
        setIsReady(true);
      }, 300);
    } else {
      setIsReady(false);
    }

    return () => clearTimeout(timeout);
  }, [dialogOpen]);

  return (
    <EditorErrorBoundary>
      <ClientOnly fallback={<EditorLoading />}>
        {isReady ? (
          <Suspense fallback={<EditorLoading />}>
            <LazyRichTextEditor 
              content={content} 
              onChange={onChange} 
            />
          </Suspense>
        ) : (
          <EditorLoading />
        )}
      </ClientOnly>
    </EditorErrorBoundary>
  );
}
