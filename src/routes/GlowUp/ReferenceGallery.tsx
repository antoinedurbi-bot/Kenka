import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import type { GlowUpCategory, ReferenceImage } from "../../db/types";
import { compressImage } from "../../lib/image";
import { usePhotoUrl } from "../../lib/usePhotoUrl";
import { Modal } from "../../components/ui";

/**
 * Références visuelles déposées par l'utilisateur — coupe visée, tenue,
 * posture à corriger. L'app n'en fournit aucune : c'est un cadre vide que
 * l'utilisateur remplit avec ses propres images, stockées en local comme les
 * photos de progression, jamais distribuées.
 */
export function ReferenceGallery({ category }: { category: GlowUpCategory }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<ReferenceImage | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const images =
    useLiveQuery(
      () => db.referenceImages.where("category").equals(category).sortBy("order"),
      [category],
    ) ?? [];

  const add = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      await db.referenceImages.add({ category, blob, order: Date.now() });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="k-label">Références perso</span>
        <button
          className="k-btn-ghost !px-2.5 !py-1 !text-[10px]"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? "…" : "+ Ajouter"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => add(e.target.files?.[0])}
        />
      </div>

      {images.length === 0 ? (
        <div className="k-hatch border border-dashed border-ink-800 px-3 py-4 text-center">
          <p className="text-xs leading-relaxed text-bone-600">
            Dépose ici tes propres références — une coupe, une tenue, une posture. Rien n'est
            fourni par l'app : ce sont tes images, stockées uniquement sur cet appareil.
          </p>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img) => (
            <Thumb key={img.id} image={img} onOpen={() => setOpen(img)} />
          ))}
        </div>
      )}

      <ReferenceViewer image={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function Thumb({ image, onOpen }: { image: ReferenceImage; onOpen: () => void }) {
  const url = usePhotoUrl(image.blob);
  return (
    <button
      onClick={onOpen}
      className="aspect-[3/4] w-24 shrink-0 overflow-hidden border border-ink-700"
    >
      {url && <img src={url} alt={image.caption ?? "Référence"} className="h-full w-full object-cover" />}
    </button>
  );
}

function ReferenceViewer({
  image,
  onClose,
}: {
  image: ReferenceImage | null;
  onClose: () => void;
}) {
  const url = usePhotoUrl(image?.blob);
  const [caption, setCaption] = useState(image?.caption ?? "");

  if (!image) return null;

  return (
    <Modal open onClose={onClose} title="Référence">
      <div className="space-y-3">
        {url && <img src={url} alt="" className="w-full border border-ink-700" />}
        <input
          className="k-field"
          placeholder="Légende (optionnel)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => db.referenceImages.update(image.id!, { caption: caption.trim() || undefined })}
        />
        <button
          className="k-btn-danger w-full"
          onClick={async () => {
            await db.referenceImages.delete(image.id!);
            onClose();
          }}
        >
          Supprimer
        </button>
      </div>
    </Modal>
  );
}
