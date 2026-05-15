import type { DiagnosisSection, PostDiagnosis } from "@workspace/api-client-react";
export type { DiagnosisSection, PostDiagnosis };

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
  reposts: number;
  saves: number;
  sends: number;
  membersReached: number;
  followersGained: number;
  linkEngagements: number;
  demographics: unknown;
  linkedinUrl: string | null;
  linkedinPostDate: string | null;
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
  log: (draftId: number, data: {
    impressions: number; reactions: number; comments: number;
    reposts?: number; saves?: number; sends?: number;
    membersReached?: number; followersGained?: number; linkEngagements?: number;
    linkedinUrl?: string | null;
  }) =>
    apiFetch<PerformanceSignal>(`/drafts/${draftId}/performance`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  uploadXlsx: async (draftId: number, file: File): Promise<{
    signal: PerformanceSignal;
    parsed: Record<string, unknown>;
    analysis?: { strengths: string[]; takeaways: string[]; futureImprovement: string };
  }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/drafts/${draftId}/performance/upload`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ signal: PerformanceSignal; parsed: Record<string, unknown>; analysis?: { strengths: string[]; takeaways: string[]; futureImprovement: string } }>;
  },
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
  generate: (postContent: string, style: string, audience?: string, feeling?: string) =>
    apiFetch<{ scenePrompt: string; caption: string; chosenStyle: string }>("/ai/generate-illustration-concept", {
      method: "POST",
      body: JSON.stringify({ postContent, style, audience, feeling }),
    }),
  editScene: (currentScene: string, editRequest: string) =>
    apiFetch<{ revisedScene: string }>("/ai/edit-scene", {
      method: "POST",
      body: JSON.stringify({ currentScene, editRequest }),
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

export type PainPoint = {
  title: string;
  description: string;
  angle: string;
};

export type SkillAngle = {
  angle: string;
  hook: string;
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
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<void>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export type StressTestFactor = {
  name: string;
  score: number;
  maxScore: number;
  why: string;
  howToFix?: string;
};

export type StressTestResult = {
  score: number;
  factors: StressTestFactor[];
  fixes: string[];
  personalInsight?: string;
  publishReady: boolean;
};

export type StressTestScoreEntry = {
  score: number;
  publishReady: boolean;
  createdAt: string;
  factors?: StressTestFactor[];
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
  painPoints: () =>
    apiFetch<{ painPoints: PainPoint[] }>("/agent/pain-points"),
  skillAngles: (skill: string) =>
    apiFetch<{ angles: SkillAngle[] }>("/agent/skill-angles", {
      method: "POST",
      body: JSON.stringify({ skill }),
    }),
  stressTest: (postContent: string, draftId?: number | null) =>
    apiFetch<StressTestResult>("/agent/stress-test", {
      method: "POST",
      body: JSON.stringify({ postContent, draftId }),
    }),
  stressTestScores: () =>
    apiFetch<Record<string, StressTestScoreEntry>>("/agent/stress-test/scores"),
};

export type KpiTrend = { current: number | null; prior: number | null; trend: "up" | "down" | "flat" | null };

export type AnalyticsOverview = {
  totalPublished: number;
  avgResonance: number;
  loggedPerformanceCount: number;
  byTone: { tone: string; count: number; sampledCount: number; avgResonance: number | null }[];
  byContentSource: { source: string; count: number; avgResonance: number | null; sampledCount: number }[];
  byVisualType: { type: string; count: number; avgResonance: number | null; sampledCount: number }[];
  byObjective: { objective: string; count: number; avgResonance: number | null; sampledCount: number }[];
  topPosts: { id: number; topic: string; resonance: number; engagementRate: number | null; tone: string | null; contentSource: string; visualType: string; publishedAt: string }[];
  weeklyTrend: { week: string; count: number }[];
  weeklyResonanceTrend: { week: string; avgResonance: number; sampleCount: number }[];
  last30: number;
  last60: number;
  last90: number;
  kpiTrends: { avgResonance: KpiTrend; totalPublished: KpiTrend; avgEngagementRate: KpiTrend };
  avgEngagementRate: number | null;
  postingConsistency: { avgDaysBetweenPosts: number | null; prior: number | null; trend: "up" | "down" | "flat" | null };
  bestTimeToPost: {
    byDayOfWeek: { day: string; count: number; avgResonance: number | null }[];
    byTimeBlock: { block: string; count: number; avgResonance: number | null }[];
    topCombination: { day: string; block: string; avgResonance: number } | null;
  };
  hashtagPerformance: { hashtag: string; count: number; avgResonance: number | null }[];
  byMediaFormat: { format: string; count: number; avgResonance: number | null; sampledCount: number }[];
};

export const analyticsApi = {
  overview: (window: 30 | 60 | 90 = 90) => apiFetch<AnalyticsOverview>(`/analytics/overview?window=${window}`),
};

export type VoiceSuggestion = {
  id: number;
  userId: number;
  field: string;
  currentValue: string;
  suggestedValue: string;
  rationale: string;
  evidenceDraftIds: number[];
  evidenceSnippets: string[];
  status: string;
  createdAt: string;
};

export type VoiceInsightsResult =
  | { status: "insufficient"; count: number; suggestions: [] }
  | { status: "ok"; suggestions: VoiceSuggestion[] };

export const voiceInsightsApi = {
  generate: () =>
    apiFetch<VoiceInsightsResult>("/ai/voice-insights", { method: "POST" }),
  list: () => apiFetch<VoiceSuggestion[]>("/voice-suggestions"),
  accept: (id: number) =>
    apiFetch<VoiceSuggestion>(`/voice-suggestions/${id}/accept`, { method: "PATCH" }),
  dismiss: (id: number) =>
    apiFetch<VoiceSuggestion>(`/voice-suggestions/${id}/dismiss`, { method: "PATCH" }),
};

export const diagnosisApi = {
  get: (draftId: number) =>
    apiFetch<{ diagnosis: PostDiagnosis }>(`/ai/post-diagnosis/${draftId}`, { method: "POST" }),
};

export const resonanceMapApi = {
  get: () => apiFetch<Record<string, number>>("/analytics/resonance-map"),
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
