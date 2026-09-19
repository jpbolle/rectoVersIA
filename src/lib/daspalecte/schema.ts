// Contrat d'ingestion partagé avec `daspa-extension/analytics.js` — conservé à
// l'identique depuis daspa-app : l'extension n'a que son adresse à changer.

export type DaspalecteEventType =
  | 'word'
  | 'comprehension'
  | 'exercise'
  | 'reading_test'
  | 'capture'
  | 'ai_call';

export interface IngestEvent {
  /** Généré par le client : sert d'identifiant de document, donc de garde-fou
   *  contre les doublons quand la file d'attente de l'extension rejoue un lot. */
  id: string;
  type: DaspalecteEventType;
  at: number;
  payload: Record<string, unknown>;
}

export interface IngestBody {
  source: 'extension' | 'addon';
  session: {
    id: string;
    startedAt: number;
    context: { url: string | null; title: string | null; hostApp: string };
  };
  events: IngestEvent[];
}

/** Au-delà, le lot est refusé (l'extension n'en envoie jamais plus). */
export const MAX_EVENTS_PER_BATCH = 100;

const EVENT_TYPES: DaspalecteEventType[] = [
  'word', 'comprehension', 'exercise', 'reading_test', 'capture', 'ai_call',
];

export type ParseResult = { ok: true; body: IngestBody } | { ok: false; error: string };

export function parseIngestBody(raw: unknown): ParseResult {
  if (!isRecord(raw)) return fail('invalid_body');

  const source = raw.source === 'addon' ? 'addon' : 'extension';

  if (!isRecord(raw.session)) return fail('missing_session');
  const sessionId = str(raw.session.id);
  if (!sessionId || sessionId.length > 128 || sessionId.includes('/')) {
    return fail('invalid_session_id');
  }
  const context = isRecord(raw.session.context) ? raw.session.context : {};

  if (!Array.isArray(raw.events)) return fail('missing_events');
  if (raw.events.length === 0) return fail('empty_events');
  if (raw.events.length > MAX_EVENTS_PER_BATCH) return fail('too_many_events');

  const events: IngestEvent[] = [];
  for (const candidate of raw.events) {
    if (!isRecord(candidate)) return fail('invalid_event');
    const id = str(candidate.id);
    const type = candidate.type as DaspalecteEventType;
    if (!id || id.length > 128 || id.includes('/')) return fail('invalid_event_id');
    if (!EVENT_TYPES.includes(type)) return fail('invalid_event_type');
    events.push({
      id,
      type,
      at: clampTime(candidate.at),
      payload: isRecord(candidate.payload) ? candidate.payload : {},
    });
  }

  return {
    ok: true,
    body: {
      source,
      session: {
        id: sessionId,
        startedAt: clampTime(raw.session.startedAt),
        context: {
          url: truncate(str(context.url), 2000),
          title: truncate(str(context.title), 300),
          hostApp: str(context.hostApp) ?? 'web',
        },
      },
      events,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function truncate(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max);
}

/** Une horloge cliente peut être fausse : on refuse le futur et l'antiquité. */
function clampTime(value: unknown): number {
  const now = Date.now();
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : now;
  if (parsed > now || parsed < now - 365 * 86_400_000) return now;
  return Math.round(parsed);
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}
