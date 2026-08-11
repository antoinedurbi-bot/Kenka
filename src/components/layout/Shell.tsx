import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Une fois entré dans une section depuis le hub, il n'y a plus de barre du
 * bas à lire : le seul chemin est explicite — revenir au choix, ou aller
 * aux réglages. Ça libère aussi l'écran entier pour le contenu de la
 * section, plutôt que de lui retirer une bande fixe en permanence.
 */
export function Shell() {
  const { pathname } = useLocation();

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col">
      <TopBar />
      <main key={pathname} className="flex-1 px-4 pb-10 pt-4">
        <Outlet />
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className="safe-top sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <NavLink
          to="/"
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600 hover:text-bone-200"
        >
          <span aria-hidden>←</span> Sections
        </NavLink>
        <NavLink
          to="/reglages"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600 hover:text-bone-200"
        >
          Réglages
        </NavLink>
      </div>
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 border-b border-ink-800 pb-4">
      <div className="k-label text-blood-500">{eyebrow}</div>
      <h1 className="mt-1.5 text-2xl leading-none">{title}</h1>
      {children && <div className="mt-2 text-sm text-bone-400">{children}</div>}
    </div>
  );
}
