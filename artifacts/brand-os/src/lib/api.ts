import type { DiagnosisSection, PostDiagnosis, BrandReviewCache as ApiBrandReviewCache } from "@workspace/api-client-react";
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
  linkedinFeedbackStatus: "reported" | "not_reported" | "unknown";
  linkedinFeedbackLabel: string | null;
  linkedinFeedbackSource: string | null;
  linkedinFeedbackRaw: string | null;
  loggedAt: string;
};

export type AngleCheckResult =
  | { similar: false }
  | { similar: true; match: { draftId: number; topic: string; angle: string }; score: number; freshAngles: string[] };

export type VoiceSummaryResult = {
  summary: string | null;
  draftCount: number;
  confidence: "starting" | "developing" | "grounded";
  evidence: {
    writingSamples: number;
    proofPoints: number;
    contentPillars: number;
    hasAboutMe: boolean;
    hasVoiceDNA: boolean;
  };
};

export type AuthenticityCheck = {
  editPct: number | null;
  flags: string[];
  severity: "low" | "medium" | "high";
  wordChangeSummary?: {
    originalWordCount: number;
    finalWordCount: number;
    unchangedWordCount: number;
    removedWordCount: number;
    addedWordCount: number;
    unchangedPct: number;
    aiChangedPct: number;
    userAddedPct: number;
    removedWords: string[];
    addedWords: string[];
  } | null;
} | null;

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
  update: (id: number, content: string) =>
    apiFetch<Thought>(`/thoughts/${id}`, { method: "PATCH", body: JSON.stringify({ content }) }),
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

export const authenticityApi = {
  check: (data: { draftId?: number; aiOriginalPost?: string | null; postOutput?: string }) =>
    apiFetch<{ check: AuthenticityCheck }>("/drafts/authenticity-check", {
      method: "POST",
      body: JSON.stringify(data),
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
    linkedinPostDate?: string | null;
    linkedinFeedbackStatus?: "reported" | "not_reported" | "unknown";
    linkedinFeedbackLabel?: string | null;
    linkedinFeedbackSource?: string | null;
    linkedinFeedbackRaw?: string | null;
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

export type VoiceSignalEntry = {
  id: number;
  draftId: number;
  topic: string | null;
  signals: {
    sentenceStyle?: string;
    punctuationStyle?: string;
    openingStyle?: string;
    vocabulary?: string[];
    structurePattern?: string;
    toneMarkers?: string[];
  };
  createdAt: string;
};

export type DareResult = {
  dare: string;
  why: string;
  risk: "Mild" | "Medium" | "Spicy";
  expiresAt: string;
  remaining: number;
};

export const voiceApi = {
  getSummary: () => apiFetch<VoiceSummaryResult>("/user/voice-summary"),
  refresh: () => apiFetch<VoiceSummaryResult & { remaining: number }>("/user/voice-refresh", { method: "POST" }),
  signals: () => apiFetch<{ signals: VoiceSignalEntry[] }>("/user/voice-signals"),
};

export type MomentumData = {
  score: number;
  label: string;
  breakdown: { recency: number; variety: number; volume: number; resonance: number };
  streak: number;
  cadenceAlerts: Array<{ type: string; message: string; daysSince: number; objective?: string }>;
  weeklyWall: Array<{ weekStart: string; posted: boolean }>;
  currentWeekDays: boolean[];
  weekStreak: number;
};

export type AudienceMix = {
  ready: boolean;
  total: number;
  counts: Record<string, number>;
  topAudience?: string;
  topPct?: number;
  skewed?: boolean;
  missing?: string[];
};

export const momentumApi = {
  get: () => apiFetch<MomentumData>("/momentum"),
  audienceMix: () => apiFetch<AudienceMix>("/momentum/audience-mix"),
};

export type Topic = {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
  draftCount: number;
};

export const topicsApi = {
  list: () => apiFetch<Topic[]>("/topics"),
  create: (name: string, color?: string | null) =>
    apiFetch<Topic>("/topics", { method: "POST", body: JSON.stringify({ name, color }) }),
  update: (id: number, data: { name?: string; color?: string | null }) =>
    apiFetch<Topic>(`/topics/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/topics/${id}`, { method: "DELETE" }),
};

export type SeriesFormat = "standard" | "dialogue" | "letter" | "qa" | "story_arc";
export type SeriesStatus = "planning" | "active" | "completed";

export type SeriesPerformance = {
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves: number;
};

export type Series = {
  id: number;
  title: string;
  theme: string;
  topicId: number | null;
  targetAudience: string | null;
  format: SeriesFormat;
  // Null = endless — no fixed part count.
  plannedParts: number | null;
  status: SeriesStatus;
  hook: string | null;
  plannedAngles: Array<{ part: number; angle: string }> | null;
  createdAt: string;
  updatedAt: string;
  partsWritten: number;
  partsPublished: number;
  performance: SeriesPerformance;
};

export type SeriesPart = {
  id: number;
  seriesPart: number | null;
  status: string;
  postOutput: string | null;
  createdAt: string;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  saves: number | null;
};

export type SeriesDetail = Series & { parts: SeriesPart[] };

export type PlannedPart = { part: number; angle: string };

export const seriesApi = {
  list: () => apiFetch<Series[]>("/series"),
  get: (id: number) => apiFetch<SeriesDetail>(`/series/${id}`),
  create: (data: { title: string; theme: string; topicId?: number | null; targetAudience?: string | null; format: SeriesFormat; plannedParts: number | null; hook?: string | null }) =>
    apiFetch<Series>("/series", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{ title: string; theme: string; topicId: number | null; targetAudience: string | null; format: SeriesFormat; plannedParts: number | null; status: SeriesStatus; hook: string | null; plannedAngles: PlannedPart[] | null }>) =>
    apiFetch<Series>(`/series/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/series/${id}`, { method: "DELETE" }),
  inferFormat: (title: string, theme?: string) =>
    apiFetch<{ format: SeriesFormat; rationale: string }>("/series/infer-format", {
      method: "POST",
      body: JSON.stringify({ title, theme }),
    }),
  plan: (id: number, options?: { scope?: "all" | "remaining"; guidance?: string }) =>
    apiFetch<{ parts: PlannedPart[] }>(`/series/${id}/plan`, { method: "POST", body: JSON.stringify(options ?? {}) }),
};

export type ExtractedBrandVoice = {
  brandRole: string;
  brandAudience: string;
  brandBelief: string;
  objective: string;
  persona: string;
  tone: string;
  summary: string;
  contentPillars: string[];
  proofPoints: string[];
  firstPostAngles: string[];
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

export type ProfileFacts = {
  headline: string | null;
  about: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  currentRoleDates: string | null;
  achievements: string[];
  skills: string[];
};

export type ApplicableSource = "cv" | "brandmoi" | "linkedin";

export type ComparisonStatus =
  | "all_agree"
  | "cv_brandmoi_agree_linkedin_differs"
  | "cv_linkedin_agree_brandmoi_stale"
  | "brandmoi_linkedin_agree_cv_differs"
  | "all_differ"
  | "only_one_source"
  | "insufficient_data";

type SourceValue = { value: string | string[]; source: ApplicableSource } | null;

export type ComparisonRow = {
  rowKey: "role_title" | "territories" | "audience" | "recent_content_themes";
  label: string;
  applicableSources: ApplicableSource[];
  cv: SourceValue;
  brandmoi: SourceValue;
  linkedin: SourceValue;
  status: ComparisonStatus;
  statusDetail: string;
};

export type ProofPointComparisonRow = {
  rowKey: "proof_points";
  label: string;
  applicableSources: ApplicableSource[];
  points: Array<{ point: string; presentInCv: boolean; reflectedInLinkedin: boolean }>;
  status: ComparisonStatus;
  statusDetail: string;
};

export type ComparisonTable = {
  generatedAt: string;
  rows: Array<ComparisonRow | ProofPointComparisonRow>;
};

export type TargetAudience = "Recruiters" | "Hiring managers" | "Clients" | "Peers" | "Investors" | "General";

export type RecommendationStatus = "pending" | "accepted" | "edited" | "rejected";

export type FieldRewrite = {
  id: string;
  field: "headline" | "about" | "current_role";
  currentBrandmoi: string | null;
  currentLinkedin: string | null;
  rewrite: string;
  rationale: string;
  status: RecommendationStatus;
  editedValue?: string;
};

export type PairedFactSuggestion = {
  id: string;
  rowKey: ComparisonRow["rowKey"];
  claim: string;
  updateBrandmoi: {
    targetField: "brandRole" | "aboutMe" | "contentPillars" | "proofPoints";
    suggestedValue: string | string[];
    status: RecommendationStatus;
    editedValue?: string | string[];
  };
  updateLinkedin: {
    suggestedValue: string;
    status: RecommendationStatus;
    editedValue?: string;
  };
};

export type ProfileAlignmentAnalysis = {
  id: number;
  targetAudience: TargetAudience;
  comparisonTable: ComparisonTable;
  narrativeSummary: string;
  fieldRewrites: FieldRewrite[];
  pairedFactSuggestions: PairedFactSuggestion[];
  createdAt: string;
};

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", credentials: "include", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const profileAlignmentApi = {
  uploadCv: (file: File) => {
    const form = new FormData();
    form.append("document", file);
    return postForm<ProfileFacts>("/profile-alignment/cv", form);
  },
  uploadLinkedin: (file: File) => {
    const form = new FormData();
    form.append("document", file);
    return postForm<ProfileFacts>("/profile-alignment/linkedin", form);
  },
  // The backend endpoint always expects multipart (it runs multer
  // unconditionally) — pasted text goes as a form field, not JSON, so it
  // lands in req.body.pastedText the same way multer parses any non-file field.
  pasteLinkedin: (pastedText: string) => {
    const form = new FormData();
    form.append("pastedText", pastedText);
    return postForm<ProfileFacts>("/profile-alignment/linkedin", form);
  },
  comparison: () => apiFetch<ComparisonTable>("/profile-alignment/comparison"),
  analyze: (targetAudience: TargetAudience) =>
    apiFetch<ProfileAlignmentAnalysis>("/profile-alignment/analyze", { method: "POST", body: JSON.stringify({ targetAudience }) }),
  reviewRecommendation: (
    analysisId: number,
    recId: string,
    status: RecommendationStatus,
    opts?: { target?: "brandmoi" | "linkedin"; editedValue?: string | string[] },
  ) =>
    apiFetch<{ ok: true }>(`/profile-alignment/analyses/${analysisId}/recommendations/${recId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, target: opts?.target, editedValue: opts?.editedValue }),
    }),
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
  updateFields: (fields: Partial<{ brandRole: string; aboutMe: string; contentPillars: string[]; proofPoints: string[]; lastSeenUpdateId: string | null; seenPageTours: string[] }>) =>
    apiFetch<unknown>("/user/preferences", { method: "PUT", body: JSON.stringify(fields) }),
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

export type BrandAngle = {
  angle: string;
  audience: string;
  scenarioType?: string;
  scenario?: string;
  tension?: string;
  whyItResonates?: string;
  professionalTerritory?: string;
  professionalSignal?: string;
};

export type AgentBrief = {
  headline: string;
  insight: string;
  angles: BrandAngle[];
  teachAngles: string[];
  newsHeadline?: string;
  newsSourceLine?: string;
  newsUrl?: string;
  newsPublishedAt?: string;
  newsSourceDomain?: string;
  newsDescription?: string;
  trendingTopics?: { headline: string; sourceLine?: string }[];
  seriesNudge?: { seriesId: number; title: string; nextPart: number; plannedParts: number | null };
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
  persistenceWarning?: string;
};

export type StressTestScoreEntry = {
  score: number;
  publishReady: boolean;
  createdAt: string;
  factors?: StressTestFactor[];
};

export type SavedIdea = {
  id: number;
  text: string;
  type: string;
  createdAt: string;
};

export type TopPostSuggestion = {
  originalTopic: string;
  engagementScore: number;
  why: string;
  angles: { label: string; angle: string }[];
};

export type BrandReviewRecommendation = {
  id: string;
  title: string;
  issue: string;
  change: string;
  instruction: string;
  example?: string;
  priority: "high" | "medium";
};

export type BrandReviewSignal = {
  key: "specificity" | "positioning" | "voice";
  label: string;
  status: "strong" | "mixed" | "needs_attention";
  detail: string;
};

export type BrandReviewResult = {
  verdict: "specific" | "mixed" | "generalist";
  headline: string;
  summary: string;
  signals: BrandReviewSignal[];
  strengths: string[];
  recommendations: BrandReviewRecommendation[];
};

export type CachedBrandReview = ApiBrandReviewCache & {
  fromCache?: boolean;
  isStale?: boolean;
};

export const agentApi = {
  brief: () => apiFetch<AgentBrief>("/agent/brief"),
  dare: () => apiFetch<DareResult>("/agent/dare", { method: "POST" }),
  brandIdeas: (topicId?: number | null) =>
    apiFetch<{ angles: BrandAngle[] }>("/agent/ideas", { method: "POST", body: JSON.stringify({ type: "brand", topicId: topicId ?? undefined }) }),
  teachIdeas: () =>
    apiFetch<{ angles: string[] }>("/agent/ideas", { method: "POST", body: JSON.stringify({ type: "teach" }) }),
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
  stressTest: (postContent: string, draftId?: number | null, fixesApplied?: boolean) =>
    apiFetch<StressTestResult>("/agent/stress-test", {
      method: "POST",
      body: JSON.stringify({ postContent, draftId, fixesApplied }),
    }),
  stressTestScores: () =>
    apiFetch<Record<string, StressTestScoreEntry>>("/agent/stress-test/scores"),
  ideaFeedback: (ideaText: string, ideaType: "brand" | "teach", signal: "like" | "dislike") =>
    apiFetch<{ id: number }>("/agent/idea-feedback", {
      method: "POST",
      body: JSON.stringify({ ideaText, ideaType, signal }),
    }),
  savedIdeas: () =>
    apiFetch<{ ideas: SavedIdea[] }>("/agent/saved-ideas"),
  deleteSavedIdea: (id: number) =>
    apiFetch<{ ok: boolean }>(`/agent/saved-ideas/${id}`, { method: "DELETE" }),
  topPostSuggestions: () =>
    apiFetch<{ suggestions: TopPostSuggestion[]; reason?: string }>("/agent/top-post-suggestions"),
  brandReview: (postText: string, draftId?: number | null, force = false) =>
    apiFetch<CachedBrandReview>("/agent/brand-review", {
      method: "POST",
      body: JSON.stringify({ postText, ...(draftId ? { draftId } : {}), force }),
    }),
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
  topPosts: { id: number; topic: string; resonance: number; engagementRate: number | null; impressions: number; reactions: number; comments: number; reposts: number; tone: string | null; contentSource: string; visualType: string; publishedAt: string }[];
  weeklyTrend: { week: string; count: number }[];
  weeklyResonanceTrend: { week: string; avgResonance: number; sampleCount: number }[];
  last30: number;
  last60: number;
  last90: number;
  kpiTrends: { avgResonance: KpiTrend; totalPublished: KpiTrend; avgEngagementRate: KpiTrend; totalImpressions: KpiTrend };
  avgEngagementRate: number | null;
  totalImpressions: number;
  postingConsistency: { avgDaysBetweenPosts: number | null; prior: number | null; trend: "up" | "down" | "flat" | null };
  bestTimeToPost: {
    byDayOfWeek: { day: string; count: number; avgResonance: number | null }[];
    byTimeBlock: { block: string; count: number; avgResonance: number | null }[];
    topCombination: { day: string; block: string; avgResonance: number } | null;
  };
  hashtagPerformance: { hashtag: string; count: number; avgResonance: number | null }[];
  byMediaFormat: { format: string; count: number; avgResonance: number | null; sampledCount: number }[];
  learningMetrics: {
    authorFeedback: {
      reviewedDrafts: number;
      soundsLikeMe: number;
      tooGeneric: number;
      needsSpecificity: number;
      tooPolished: number;
      approvalRate: number | null;
    };
    evidence: {
      pinnedWritingSamples: number;
      authenticatedPosts: number;
      materiallyEditedBeforePublish: number;
    };
    outcomes: {
      performanceEntries: number;
      externalFeedbackReported: number;
      externalFeedbackNotReported: number;
      externalFeedbackUnknown: number;
    };
  };
  feedbackCoaching: { reportedPostCount: number; message: string | null };
};

export type CheckinEntry = { id: number; topic: string; ageDays: number };

export type BrandHealth = { lastAnalyzedAt: string | null; measuredPostsTotal: number; measuredPostsSince: number };
export type StudioPost = { id: number; topic: string; resonance: number | null; hasData: boolean; audience: string | null; feeling: string | null };

export type PostClassification = { topic: string | null; audience: string; feeling: string; objective: string; tone: string };

export const studioApi = {
  classifyPost: (text: string) =>
    apiFetch<PostClassification>("/agent/classify-post", { method: "POST", body: JSON.stringify({ text }) }),
  health: () => apiFetch<BrandHealth>("/agent/brand-health"),
  posts: () => apiFetch<{ posts: StudioPost[] }>("/agent/studio-posts"),
  analyze: (draftIds: number[], focus?: string) =>
    apiFetch<{ status: string; suggestions: VoiceSuggestion[]; remaining: number }>("/agent/brand-analysis", {
      method: "POST",
      body: JSON.stringify({ draftIds, ...(focus ? { focus } : {}) }),
    }),
};

export const checkinsApi = {
  list: () => apiFetch<{ checkins: CheckinEntry[] }>("/checkins"),
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

export type ResonanceMapEntry = { resonance: number; engagementRate: number | null; impressions: number; reactions: number; comments: number; reposts: number };

export const resonanceMapApi = {
  get: () => apiFetch<Record<string, ResonanceMapEntry>>("/analytics/resonance-map"),
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
