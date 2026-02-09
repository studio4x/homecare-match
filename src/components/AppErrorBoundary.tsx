import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep a console log for debugging; avoid noisy UI.
    console.error("[AppErrorBoundary] Uncaught error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card text-center">
            <h1 className="text-xl font-semibold">Algo deu errado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A página encontrou um erro inesperado. Recarregue para tentar novamente.
            </p>
            <button
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => window.location.reload()}
              type="button"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
