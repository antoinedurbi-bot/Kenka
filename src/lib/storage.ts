export interface StorageState {
  persisted: boolean;
  usageBytes?: number;
  quotaBytes?: number;
  standalone: boolean;
  isIOS: boolean;
}

/**
 * Sans ce marquage, un navigateur peut évincer IndexedDB sous pression disque —
 * et Safari efface le stockage d'un site non installé après quelques jours sans
 * visite. C'est le principal risque de perte pour une app 100 % locale.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari expose l'installation via une propriété non standard.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export async function storageState(): Promise<StorageState> {
  const state: StorageState = {
    persisted: false,
    standalone: isStandalone(),
    isIOS: isIOS(),
  };
  try {
    state.persisted = (await navigator.storage?.persisted?.()) ?? false;
    const est = await navigator.storage?.estimate?.();
    state.usageBytes = est?.usage;
    state.quotaBytes = est?.quota;
  } catch {
    // API indisponible : on affiche simplement moins d'informations.
  }
  return state;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
  return `${(bytes / 1024 ** 3).toFixed(2)} Go`;
}
