export type Thought = {
  id: number;
  userId: number;
  content: string;
  developed: boolean;
  createdAt: string;
};

export type PerformanceSignal = {
  id: number;
  draftId: number;
  impressions: number;
  reactions: number;
  comments: number;
  loggedAt: string;
};

export type AngleCheckResult =
  | { similar: false }
  | { similar: true; match: { draftId: number; topic: string; angle: string }; score: number; freshAngles: string[] };

export type VoiceSummaryResult = {
  summary: string | null;
  draftCount: number;
};

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const thoughtsApi = {
  list: () => apiFetch<Thought[]>("/thoughts"),
  create: (content: string) =>
    apiFetch<Thought>("/thoughts", { method: "POST", body: JSON.stringify({ content }) }),
  markDeveloped: (id: number) =>
    apiFetch<Thought>(`/thoughts/${id}`, { method: "PATCH", body: JSON.stringify({ developed: true }) }),
  delete: (id: number) =>
    apiFetch<void>(`/thoughts/${id}`, { method: "DELETE" }),
};

export const angleApi = {
  check: (topic: string, angle: string) =>
    apiFetch<AngleCheckResult>("/ai/check-angle", {
      method: "POST",
      body: JSON.stringify({ topic, angle }),
    }),
};

export const performanceApi = {
  get: (draftId: number) =>
    apiFetch<PerformanceSignal | null>(`/drafts/${draftId}/performance`),
  log: (draftId: number, data: { impressions: number; reactions: number; comments: number }) =>
    apiFetch<PerformanceSignal>(`/drafts/${draftId}/performance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const voiceApi = {
  getSummary: () => apiFetch<VoiceSummaryResult>("/user/voice-summary"),
};

export type MomentumData = {
  score: number;
  label: string;
  breakdown: { recency: number; variety: number; volume: number; resonance: number };
  streak: number;
  cadenceAlerts: Array<{ type: string; message: string; daysSince: number; objective?: string }>;
};

export const momentumApi = {
  get: () => apiFetch<MomentumData>("/momentum"),
};
