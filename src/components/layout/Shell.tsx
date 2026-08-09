import clsx from "clsx";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Base", icon: KanjiIcon("拳") },
  { to: "/physique", label: "Physique", icon: KanjiIcon("体") },
  { to: "/combat", label: "Combat", icon: KanjiIcon("闘") },
  { to: "/photos", label: "Photos", icon: KanjiIcon("影") },
  { to: "/glow-up", label: "Glow up", icon: KanjiIcon("道") },
];

function KanjiIcon(char: string) {
  return (
    <span className="font-display text-[17px] leading-none" aria-hidden>
      {char}
    </span>
  );
}

export function Shell() {
  const { pathname } = useLocation();

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col">
      <TopBar />
      <main key={pathname} className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  return (
    <header className="safe-top sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <NavLink to="/" className="flex items-baseline gap-2">
          <span className="font-display text-lg tracking-[0.2em] text-bone-50">KENKA</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-blood-500">喧嘩</span>
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

function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-3xl border-t border-ink-800 bg-ink-950/97 backdrop-blur">
      <div className="grid grid-cols-5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center gap-1.5 border-t-2 py-2.5 transition-colors",
                isActive
                  ? "border-blood-500 text-bone-50"
                  : "border-transparent text-bone-600 hover:text-bone-400",
              )
            }
          >
            {item.icon}
            <span className="font-mono text-[9px] uppercase tracking-[0.1em]">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
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
