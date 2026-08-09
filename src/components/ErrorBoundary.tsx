import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface State {
  error?: Error;
}

/**
 * Une exception de rendu ne doit jamais donner un écran noir sur une app qui
 * contient les seules copies des données : on garde une porte de sortie vers
 * l'export de sauvegarde.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("KENKA — erreur de rendu", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8">
        <div className="k-label text-blood-500">Erreur</div>
        <h1 className="mt-2 text-xl">L'écran n'a pas pu s'afficher</h1>
        <p className="mt-3 text-sm leading-relaxed text-bone-400">
          Tes données sont intactes — seule l'interface a échoué. Recharger suffit dans la plupart
          des cas.
        </p>

        <pre className="mt-4 max-h-40 overflow-auto border border-ink-700 bg-ink-900 p-2.5 font-mono text-[10px] leading-relaxed text-bone-600">
          {error.message}
        </pre>

        <div className="mt-5 space-y-2">
          <button className="k-btn-primary w-full" onClick={() => location.reload()}>
            Recharger
          </button>
          <a className="k-btn-ghost w-full" href="#/reglages" onClick={() => location.reload()}>
            Aller aux réglages pour exporter
          </a>
        </div>
      </div>
    );
  }
}
