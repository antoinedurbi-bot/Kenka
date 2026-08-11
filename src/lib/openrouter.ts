/**
 * Client OpenRouter minimal, appelé directement depuis le navigateur avec la
 * clé API de l'utilisateur — la seule fonctionnalité de l'app qui a besoin du
 * réseau. Pas de serveur Kenka au milieu : la clé ne transite jamais que
 * vers OpenRouter, stockée uniquement en local (IndexedDB) sur l'appareil.
 */

export type OpenRouterRole = "system" | "user" | "assistant";

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
}

export const OPENROUTER_MODELS = [
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (gratuit)" },
] as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterRequestSpec {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Construction pure de la requête — testable sans réseau. */
export function buildOpenRouterRequest(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
): OpenRouterRequestSpec {
  return {
    url: OPENROUTER_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Recommandés par OpenRouter pour identifier l'app appelante côté tableau de bord.
      "HTTP-Referer": "https://kenka.app",
      "X-Title": "Kenka",
    },
    body: JSON.stringify({ model, messages }),
  };
}

interface OpenRouterApiResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/** Extraction pure de la réponse — testable avec un JSON simulé. */
export function parseOpenRouterResponse(json: OpenRouterApiResponse): string {
  if (json.error?.message) throw new Error(json.error.message);
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Réponse vide ou inattendue.");
  }
  return content;
}

export async function sendChatMessage(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
): Promise<string> {
  const req = buildOpenRouterRequest(apiKey, model, messages);
  const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      message = (JSON.parse(text) as OpenRouterApiResponse).error?.message ?? text;
    } catch {
      // corps non-JSON : on garde le texte brut
    }
    throw new Error(`OpenRouter (${res.status}) : ${message || res.statusText}`);
  }

  const json = (await res.json()) as OpenRouterApiResponse;
  return parseOpenRouterResponse(json);
}
