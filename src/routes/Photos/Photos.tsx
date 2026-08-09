import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import type { PhotoAngle, ProgressPhoto } from "../../db/types";
import { compressImage } from "../../lib/image";
import { usePhotoUrl } from "../../lib/usePhotoUrl";
import { daysBetween, isoDay, prettyDate } from "../../lib/dates";
import { PageHeader } from "../../components/layout/Shell";
import { Tabs } from "../../components/layout/Tabs";
import { Empty, Modal, Panel, SectionTitle, Tag } from "../../components/ui";

const ANGLES: Array<{ value: PhotoAngle; label: string }> = [
  { value: "face", label: "Face" },
  { value: "profil", label: "Profil" },
  { value: "dos", label: "Dos" },
];

type Tab = "timeline" | "compare" | "guide";

export function Photos() {
  const [tab, setTab] = useState<Tab>("timeline");
  const photos = useLiveQuery(() => db.photos.orderBy("date").reverse().toArray(), []) ?? [];

  const lastDate = photos[0]?.date;
  const daysSince = lastDate ? daysBetween(lastDate, isoDay()) : undefined;

  return (
    <>
      <PageHeader eyebrow="Miroir" title="Suivi photo">
        Une session par semaine, pas plus. Les mêmes conditions à chaque fois — c'est la
        comparabilité qui fait la valeur de la série, pas la photo isolée.
      </PageHeader>

      {daysSince !== undefined && (
        <div className="mb-4 flex items-center gap-2">
          <Tag tone={daysSince >= 7 ? "blood" : "jade"}>
            {daysSince === 0 ? "Photo prise aujourd'hui" : `${daysSince} j depuis la dernière`}
          </Tag>
          {daysSince >= 7 && <span className="text-xs text-bone-600">Session à faire.</span>}
        </div>
      )}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "timeline", label: "Timeline" },
          { value: "compare", label: "Avant / après" },
          { value: "guide", label: "Protocole" },
        ]}
      />

      {tab === "timeline" && <Timeline photos={photos} />}
      {tab === "compare" && <Compare photos={photos} />}
      {tab === "guide" && <Guide />}
    </>
  );
}

function Timeline({ photos }: { photos: ProgressPhoto[] }) {
  const [capturing, setCapturing] = useState(false);

  const byDate = useMemo(() => {
    const map = new Map<string, ProgressPhoto[]>();
    for (const p of photos) {
      const list = map.get(p.date) ?? [];
      list.push(p);
      map.set(p.date, list);
    }
    return [...map.entries()];
  }, [photos]);

  return (
    <div className="space-y-5">
      <SectionTitle
        action={
          <button
            className="k-btn-primary !px-3 !py-1.5 !text-xs"
            onClick={() => setCapturing(true)}
          >
            Nouvelle session
          </button>
        }
      >
        {byDate.length} session(s)
      </SectionTitle>

      {byDate.length === 0 ? (
        <Empty>Aucune photo. La première série est la référence de tout le reste.</Empty>
      ) : (
        byDate.map(([date, group]) => (
          <div key={date}>
            <div className="k-label mb-2">{prettyDate(date)}</div>
            <div className="grid grid-cols-3 gap-2">
              {ANGLES.map((a) => {
                const photo = group.find((p) => p.angle === a.value);
                return <Thumb key={a.value} photo={photo} label={a.label} />;
              })}
            </div>
          </div>
        ))
      )}

      <CaptureModal open={capturing} onClose={() => setCapturing(false)} />
    </div>
  );
}

function Thumb({ photo, label }: { photo?: ProgressPhoto; label: string }) {
  const url = usePhotoUrl(photo?.blob);
  const [zoom, setZoom] = useState(false);

  if (!photo) {
    return (
      <div className="k-hatch flex aspect-[3/4] items-center justify-center border border-dashed border-ink-800">
        <span className="k-label">{label}</span>
      </div>
    );
  }

  return (
    <>
      <button
        className="group relative aspect-[3/4] overflow-hidden border border-ink-700"
        onClick={() => setZoom(true)}
      >
        {url && <img src={url} alt={label} className="h-full w-full object-cover" />}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 to-transparent px-1.5 pb-1 pt-4 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-bone-200">
          {label}
        </span>
      </button>

      <Modal open={zoom} onClose={() => setZoom(false)} title={`${label} — ${prettyDate(photo.date)}`}>
        {url && <img src={url} alt={label} className="w-full" />}
        <button
          className="k-btn-danger mt-4 w-full"
          onClick={async () => {
            await db.photos.delete(photo.id!);
            setZoom(false);
          }}
        >
          Supprimer
        </button>
      </Modal>
    </>
  );
}

function Compare({ photos }: { photos: ProgressPhoto[] }) {
  const [angle, setAngle] = useState<PhotoAngle>("face");
  const ofAngle = photos.filter((p) => p.angle === angle).slice().reverse();

  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(-1);

  const left = ofAngle[Math.min(leftIdx, ofAngle.length - 1)];
  const right = ofAngle[rightIdx === -1 ? ofAngle.length - 1 : Math.min(rightIdx, ofAngle.length - 1)];

  const leftUrl = usePhotoUrl(left?.blob);
  const rightUrl = usePhotoUrl(right?.blob);

  if (ofAngle.length < 2) {
    return (
      <div className="space-y-4">
        <AngleSelect angle={angle} onChange={setAngle} />
        <Empty>Deux photos minimum sous cet angle pour comparer.</Empty>
      </div>
    );
  }

  const gap = left && right ? Math.abs(daysBetween(left.date, right.date)) : 0;

  return (
    <div className="space-y-4">
      <AngleSelect angle={angle} onChange={setAngle} />

      <div className="grid grid-cols-2 gap-2">
        <figure>
          <div className="aspect-[3/4] overflow-hidden border border-ink-700">
            {leftUrl && <img src={leftUrl} alt="avant" className="h-full w-full object-cover" />}
          </div>
          <figcaption className="k-label mt-1.5">{left && prettyDate(left.date)}</figcaption>
        </figure>
        <figure>
          <div className="aspect-[3/4] overflow-hidden border border-blood-600">
            {rightUrl && <img src={rightUrl} alt="après" className="h-full w-full object-cover" />}
          </div>
          <figcaption className="k-label mt-1.5 text-blood-300">
            {right && prettyDate(right.date)}
          </figcaption>
        </figure>
      </div>

      <p className="text-center font-mono text-xs tabular-nums text-bone-600">
        {gap} jours d'écart
      </p>

      <div className="space-y-3">
        <RangeRow
          label="Avant"
          value={Math.min(leftIdx, ofAngle.length - 1)}
          max={ofAngle.length - 1}
          onChange={setLeftIdx}
        />
        <RangeRow
          label="Après"
          value={rightIdx === -1 ? ofAngle.length - 1 : Math.min(rightIdx, ofAngle.length - 1)}
          max={ofAngle.length - 1}
          onChange={setRightIdx}
        />
      </div>

      <Panel className="px-3 py-3">
        <p className="text-xs leading-relaxed text-bone-600">
          Aucune retouche, aucun filtre, aucune superposition n'est appliquée à ces images. Le
          progrès affiché ailleurs dans l'app vient uniquement des mesures saisies, jamais d'une
          analyse d'image.
        </p>
      </Panel>
    </div>
  );
}

function RangeRow({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="k-label w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#a52633]"
      />
    </label>
  );
}

function AngleSelect({
  angle,
  onChange,
}: {
  angle: PhotoAngle;
  onChange: (a: PhotoAngle) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {ANGLES.map((a) => (
        <button
          key={a.value}
          onClick={() => onChange(a.value)}
          className={clsx(
            "border py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
            angle === a.value
              ? "border-blood-500 bg-blood-900 text-bone-50"
              : "border-ink-700 text-bone-600",
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function CaptureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [date, setDate] = useState(isoDay());
  const [pending, setPending] = useState<Partial<Record<PhotoAngle, Blob>>>({});
  const [busy, setBusy] = useState(false);
  const inputs = useRef<Partial<Record<PhotoAngle, HTMLInputElement | null>>>({});

  const pick = async (angle: PhotoAngle, file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      setPending((p) => ({ ...p, [angle]: blob }));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const rows = ANGLES.filter((a) => pending[a.value]).map((a) => ({
      date,
      angle: a.value,
      blob: pending[a.value]!,
    }));
    if (rows.length) await db.photos.bulkAdd(rows);
    setPending({});
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Session photo">
      <div className="space-y-4">
        <div className="space-y-1.5 border-l border-blood-600 pl-3 text-xs leading-relaxed text-bone-400">
          <p>Même pièce, même heure, même lumière — de préférence lumière du jour indirecte.</p>
          <p>Téléphone à hauteur de nombril, à 2 m, dos à un mur uni.</p>
          <p>Bras le long du corps, détendu. Ne pas contracter : c'est la version honnête.</p>
        </div>

        <label className="block">
          <span className="k-label block pb-1.5">Date</span>
          <input
            type="date"
            className="k-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {ANGLES.map((a) => (
            <div key={a.value}>
              <button
                onClick={() => inputs.current[a.value]?.click()}
                className={clsx(
                  "flex aspect-[3/4] w-full items-center justify-center border text-center transition-colors",
                  pending[a.value]
                    ? "border-blood-500 bg-blood-900/40"
                    : "k-hatch border-dashed border-ink-700",
                )}
              >
                <span className="k-label">
                  {pending[a.value] ? "✓ " : "+ "}
                  {a.label}
                </span>
              </button>
              <input
                ref={(el) => {
                  inputs.current[a.value] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pick(a.value, e.target.files?.[0])}
              />
            </div>
          ))}
        </div>

        <button
          className="k-btn-primary w-full"
          disabled={busy || Object.keys(pending).length === 0}
          onClick={submit}
        >
          {busy ? "Traitement…" : "Enregistrer la session"}
        </button>
      </div>
    </Modal>
  );
}

function Guide() {
  const rules = [
    {
      title: "Rythme",
      body: "Une session par semaine, jour fixe. Quotidien = fixation sur le miroir et bruit de mesure : le corps ne change pas en 24 h, mais l'hydratation, oui.",
    },
    {
      title: "Moment",
      body: "Le matin, à jeun, après les toilettes. C'est l'état le plus reproductible de la journée.",
    },
    {
      title: "Lumière",
      body: "Lumière du jour indirecte ou même éclairage artificiel à chaque fois. Un spot au plafond crée des ombres qui simulent une définition inexistante — et l'inverse le lendemain.",
    },
    {
      title: "Cadrage",
      body: "Téléphone posé, à hauteur de nombril, 2 m de recul, corps entier dans le cadre. Marquer l'emplacement des pieds au sol si possible.",
    },
    {
      title: "Fond",
      body: "Mur uni, toujours le même. Un fond chargé rend la comparaison illisible.",
    },
    {
      title: "Pose",
      body: "Trois angles : face, profil, dos. Bras le long du corps, détendu, respiration normale. Une série contractée peut s'ajouter, mais jamais en remplacement de la série détendue.",
    },
    {
      title: "Tenue",
      body: "Même short, torse nu. Un vêtement différent change la lecture de la taille.",
    },
    {
      title: "Lecture",
      body: "Ne pas comparer à la semaine précédente — comparer à 8 ou 12 semaines. Sur 7 jours, il n'y a rien à voir, et chercher quand même finit par démotiver.",
    },
  ];

  return (
    <div className="space-y-3">
      <Panel className="divide-y divide-ink-800">
        {rules.map((r, i) => (
          <div key={r.title} className="flex gap-3 px-3 py-3">
            <span className="font-mono text-xs tabular-nums text-blood-500">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="font-display text-sm uppercase tracking-[0.08em] text-bone-50">
                {r.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-bone-400">{r.body}</p>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
