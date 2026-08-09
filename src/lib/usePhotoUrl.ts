import { useEffect, useState } from "react";

/** Crée une object URL pour un Blob IndexedDB et la révoque au démontage. */
export function usePhotoUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}
