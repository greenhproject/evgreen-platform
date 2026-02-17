import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRetrying: boolean;
}

// Detectar si el error es por un dynamic import fallido (assets con hash viejo)
function isDynamicImportError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    (msg.includes('Expected a JavaScript') && msg.includes('text/html'))
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isRetrying: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Si es un error de dynamic import, intentar limpiar cache y recargar automáticamente
    if (isDynamicImportError(error)) {
      console.warn('[ErrorBoundary] Dynamic import failed, clearing cache and reloading...');
      
      // Verificar si ya intentamos recargar recientemente (evitar loop infinito)
      const lastReload = sessionStorage.getItem('evgreen_last_reload');
      const now = Date.now();
      
      if (lastReload && (now - parseInt(lastReload)) < 10000) {
        // Ya recargamos hace menos de 10 segundos, no recargar de nuevo
        console.warn('[ErrorBoundary] Already reloaded recently, showing error UI');
        return;
      }
      
      // Marcar que vamos a recargar
      sessionStorage.setItem('evgreen_last_reload', now.toString());
      
      // Limpiar caches del Service Worker
      if ('caches' in window) {
        caches.keys().then((names) => {
          return Promise.all(names.map((name) => caches.delete(name)));
        }).then(() => {
          console.log('[ErrorBoundary] All caches cleared');
          // Pedir al SW que se actualice
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
          }
          // Recargar la página (true = bypass cache)
          window.location.reload();
        }).catch(() => {
          window.location.reload();
        });
      } else {
        globalThis.location.reload();
      }
    }
  }

  handleReload = () => {
    this.setState({ isRetrying: true });
    
    // Limpiar caches y recargar
    if ('caches' in window) {
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      }).then(() => {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
        }
        globalThis.location.reload();
      }).catch(() => {
        globalThis.location.reload();
      });
    } else {
      globalThis.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isDynImport = this.state.error && isDynamicImportError(this.state.error);
      
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            {isDynImport ? (
              <WifiOff size={48} className="text-amber-500 mb-6 flex-shrink-0" />
            ) : (
              <AlertTriangle size={48} className="text-destructive mb-6 flex-shrink-0" />
            )}

            <h2 className="text-xl mb-2 text-foreground font-semibold">
              {isDynImport 
                ? 'Actualización disponible' 
                : 'Ocurrió un error inesperado'}
            </h2>

            <p className="text-muted-foreground text-center mb-6 max-w-md">
              {isDynImport
                ? 'Se detectó una nueva versión de EVGreen. La página se recargará automáticamente para aplicar la actualización.'
                : 'Algo salió mal. Intenta recargar la página.'}
            </p>

            {!isDynImport && (
              <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.message}
                </pre>
              </div>
            )}

            <button
              onClick={this.handleReload}
              disabled={this.state.isRetrying}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <RotateCcw size={16} className={this.state.isRetrying ? 'animate-spin' : ''} />
              {this.state.isRetrying ? 'Recargando...' : 'Recargar página'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
