import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import clsx from "clsx";
import { db } from "../../db/db";
import { useSetting } from "../../lib/useSetting";
import { useCoachingContext, summarizeContext } from "../../lib/coaching";
import { sendChatMessage } from "../../lib/openrouter";
import type { OpenRouterMessage } from "../../lib/openrouter";
import { PageHeader } from "../../components/layout/Shell";
import { Empty } from "../../components/ui";

const SYSTEM_PROMPT_PREFIX = `Tu es le coach de Kenka, une app de suivi personnel combinant deux axes : Toji (physique — corps sec, découpé, V-taper épaules/taille) et Ippo (fondamentaux du combat). Réponds en français, direct et concret, sans blabla ni disclaimers inutiles. Base-toi sur le contexte ci-dessous quand c'est pertinent, mais réponds à ce qu'on te demande. Reste bref sauf si on te demande des détails.

Contexte actuel :
`;

/**
 * Coach IA via OpenRouter — la seule fonctionnalité de l'app qui a besoin du
 * réseau. Tout le reste de Kenka fonctionne hors ligne ; celle-ci ne
 * fonctionne qu'avec une clé API renseignée dans les Réglages, jamais
 * envoyée ailleurs qu'à OpenRouter.
 */
export function Chat() {
  const [apiKey] = useSetting<string>("openrouterApiKey", "");
  const [model] = useSetting<string>("openrouterModel", "anthropic/claude-3.5-haiku");
  const ctx = useCoachingContext();
  const messages = useLiveQuery(() => db.chatMessages.orderBy("createdAt").toArray(), []) ?? [];

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setError(null);
    setSending(true);
    try {
      await db.chatMessages.add({ role: "user", content: text, createdAt: new Date().toISOString() });
      const history: OpenRouterMessage[] = [
        { role: "system", content: SYSTEM_PROMPT_PREFIX + summarizeContext(ctx) },
        ...messages.map((m) => ({ role: m.role, content: m.content }) as OpenRouterMessage),
        { role: "user", content: text },
      ];
      const reply = await sendChatMessage(apiKey, model, history);
      await db.chatMessages.add({
        role: "assistant",
        content: reply,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  if (!apiKey) {
    return (
      <>
        <PageHeader eyebrow="Coach" title="Chat">
          Un assistant IA pour poser des questions sur ta progression, via OpenRouter.
        </PageHeader>
        <Empty>
          Aucune clé API configurée.{" "}
          <Link to="/reglages" className="text-blood-400 underline underline-offset-2">
            Réglages → Assistant IA
          </Link>{" "}
          pour en ajouter une — la conversation reste sur cet appareil, seule la question part
          vers OpenRouter.
        </Empty>
      </>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col">
      <PageHeader eyebrow="Coach" title="Chat">
        Contexte : niveau, charge, volume, combat et maintien sont transmis avec chaque question.
      </PageHeader>

      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <Empty>Pose une question sur ta séance, ton plafond, ta répartition de volume…</Empty>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "max-w-[85%] whitespace-pre-wrap border px-3 py-2.5 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto border-blood-600/50 bg-blood-900/20 text-bone-50"
                : "border-ink-700 bg-ink-950 text-bone-200",
            )}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="max-w-[85%] border border-ink-700 bg-ink-950 px-3 py-2.5 text-sm text-bone-600">
            …
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mb-2 border-l border-blood-500 px-3 py-2 text-xs text-blood-300">{error}</p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="k-field min-h-[2.75rem] flex-1 resize-none py-2.5"
          rows={1}
          placeholder="Écrire…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="submit"
          className="k-btn-primary shrink-0 !px-4"
          disabled={sending || !draft.trim()}
        >
          Envoyer
        </button>
      </form>

      {messages.length > 0 && (
        <button
          className="mt-2 self-start font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 hover:text-bone-300"
          onClick={async () => {
            await db.chatMessages.clear();
          }}
        >
          Nouvelle conversation
        </button>
      )}
    </div>
  );
}
