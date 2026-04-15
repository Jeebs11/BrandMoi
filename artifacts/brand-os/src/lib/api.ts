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

export type ExtractedBrandVoice = {
  brandRole: string;
  brandAudience: string;
  brandBelief: string;
  objective: string;
  persona: string;
  tone: string;
  summary: string;
};

export const smartImportApi = {
  extract: async (file: File): Promise<ExtractedBrandVoice> => {
    const form = new FormData();
    form.append("document", file);
    const res = await fetch("/api/user/extract-brand-voice", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<ExtractedBrandVoice>;
  },
};

export const imageGenApi = {
  generate: async (
    prompt: string,
    mode: "photo" | "illustration" = "photo",
    illustrationStyle?: string
  ): Promise<{ imageBase64: string }> => {
    const res = await fetch("/api/ai/generate-image", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, mode, illustrationStyle }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ imageBase64: string }>;
  },
};

export const illustrationConceptApi = {
  generate: (postContent: string, style: string) =>
    apiFetch<{ scenePrompt: string; caption: string; chosenStyle: string }>("/ai/generate-illustration-concept", {
      method: "POST",
      body: JSON.stringify({ postContent, style }),
    }),
};

export const imagePromptApi = {
  generate: (visualDescription: string) =>
    apiFetch<{ imagePrompt: string }>("/ai/generate-image-prompt", {
      method: "POST",
      body: JSON.stringify({ visualDescription }),
    }),
};

export const preferencesApi = {
  updatePalette: (brandBgColor: string, brandAccentColor: string, brandTextColor: string) =>
    apiFetch<unknown>("/user/preferences", {
      method: "PUT",
      body: JSON.stringify({ brandBgColor, brandAccentColor, brandTextColor }),
    }),
};

export type AgentBrief = {
  headline: string;
  insight: string;
  angles: string[];
  teachAngles: string[];
  newsHeadline?: string;
  newsSourceLine?: string;
  newsUrl?: string;
  newsPublishedAt?: string;
  newsSourceDomain?: string;
  newsDescription?: string;
};

export type AgentCoach = {
  note: string;
  type: "hook" | "clarity" | "voice" | "structure" | "cta";
};

export type AgentTheme = {
  name: string;
  pattern: string;
  seriesIdea: string;
  postCount: number;
};

export const accountApi = {
  update: (data: { displayName?: string; currentPassword?: string; newPassword?: string }) =>
    apiFetch<{ id: number; email: string; displayName: string }>("/user/account", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export const agentApi = {
  brief: () => apiFetch<AgentBrief>("/agent/brief"),
  coach: (postText: string) =>
    apiFetch<AgentCoach>("/agent/coach", {
      method: "POST",
      body: JSON.stringify({ postText }),
    }),
  themes: () => apiFetch<{ themes: AgentTheme[] }>("/agent/themes"),
  newsAngles: (payload: { newsHeadline: string; newsSourceLine?: string; newsUrl?: string; newsDescription?: string }) =>
    apiFetch<{ angles: string[] }>("/agent/news-angles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  hookAlternatives: (draftText: string, tone?: string, hookTypes?: string[]) =>
    apiFetch<{ hooks: string[] }>("/agent/hook-alternatives", {
      method: "POST",
      body: JSON.stringify({ draftText, tone, hookTypes }),
    }),
};

export const aiApi = {
  generateHooks: (payload: { rawInput: string; topic: string; angle: string; hookTypes: string[] }) =>
    apiFetch<{ hooks: Array<{ text: string; type: string }> }>("/ai/hooks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type AnalyticsOverview = {
  totalPublished: number;
  avgResonance: number;
  loggedPerformanceCount: number;
  byTone: { tone: string; count: number; sampledCount: number; avgResonance: number | null }[];
  byContentSource: { source: string; count: number; avgResonance: number | null; sampledCount: number }[];
  byVisualType: { type: string; count: number; avgResonance: number | null; sampledCount: number }[];
  byObjective: { objective: string; count: number; avgResonance: number | null; sampledCount: number }[];
  topPosts: { id: number; topic: string; resonance: number; tone: string | null; contentSource: string; visualType: string; publishedAt: string }[];
  weeklyTrend: { week: string; count: number }[];
  weeklyResonanceTrend: { week: string; avgResonance: number; sampleCount: number }[];
  last30: number;
  last60: number;
  last90: number;
};

export const analyticsApi = {
  overview: () => apiFetch<AnalyticsOverview>("/analytics/overview"),
};

export type LinkedinStatus =
  | { configured: false; connected: false }
  | { configured: true; connected: false }
  | { configured: true; connected: true; displayName: string; memberUrn: string; lastSyncedAt: string | null };

export type LinkedinSyncResult = {
  imported: number;
  skipped: number;
  total: number;
};

export const linkedinApi = {
  status: () => apiFetch<LinkedinStatus>("/linkedin/status"),
  authUrl: () => "/api/linkedin/auth",
  disconnect: () => apiFetch<{ ok: boolean }>("/linkedin/disconnect", { method: "DELETE" }),
  sync: () => apiFetch<LinkedinSyncResult>("/linkedin/sync", { method: "POST" }),
};
