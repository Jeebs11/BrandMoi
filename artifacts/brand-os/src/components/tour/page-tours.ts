import type { TourStep } from "./tour-steps";

// Every step here must target an element unconditionally present at page
// mount — never something nested inside a loading/empty-state conditional.
// See composed-marinating-flask.md for the per-page audit behind this rule.

export const CAPTURE_TOUR_STEPS: TourStep[] = [
  { id: "make-it", selector: '[data-tour="make-it"]', title: "Turn it into a post", description: "Type your idea, tap Make it — you'll get a full post plus five other formats to choose from.", placement: "top" },
];

export const LIBRARY_TOUR_STEPS: TourStep[] = [
  { id: "status-filter", selector: '[data-tour="status-filter"]', title: "Filter by status", description: "Jump between drafts, ready-to-post, and published without scrolling.", placement: "bottom" },
  { id: "add-past-post", selector: '[data-tour="add-past-post"]', title: "Already posted this elsewhere?", description: "Import a past LinkedIn post so it counts toward your voice and performance history.", placement: "bottom" },
];

export const ANALYTICS_TOUR_STEPS: TourStep[] = [
  { id: "analytics-hero", selector: '[data-tour="analytics-hero"]', title: "Your headline number", description: "Engagement rate once you've logged performance, post count until then.", placement: "bottom" },
  { id: "analytics-trend", selector: '[data-tour="analytics-trend"]', title: "Your trend over time", description: "Publishing volume until you log performance, then it switches to impact.", placement: "top" },
  { id: "analytics-learning", selector: '[data-tour="analytics-learning"]', title: "How BrandMoi is learning", description: "Your direct feedback and settings lead — post outcomes are supporting context only.", placement: "top" },
];

export const SERIES_TOUR_STEPS: TourStep[] = [
  { id: "series-new", selector: '[data-tour="series-new"]', title: "Plan a multi-part arc", description: "Give it a title, theme, and format — the AI plans the individual parts for you.", placement: "bottom" },
];

export const STUDIO_TOUR_STEPS: TourStep[] = [
  { id: "studio-health", selector: '[data-tour="studio-health"]', title: "How fresh is your brand profile", description: "See when it was last tuned with real performance data.", placement: "bottom" },
  { id: "studio-analyze", selector: '[data-tour="studio-analyze"]', title: "Let your best posts teach your brand", description: "Pick a few strong posts — top performers are pre-selected — and compare them against your current profile.", placement: "top" },
  { id: "studio-aspirational", selector: '[data-tour="studio-aspirational"]', title: "Borrow a style, not a topic", description: "Paste up to 3 posts whose writing style you admire — rhythm and energy only, never topics.", placement: "top" },
];

export const VAULT_TOUR_STEPS: TourStep[] = [
  { id: "vault-capture", selector: '[data-tour="vault-capture"]', title: "Drop it here, shape it later", description: "Half-formed thought, question, or observation — no editing needed, just capture it.", placement: "bottom" },
];

export const PROFILE_ALIGNMENT_TOUR_STEPS: TourStep[] = [
  { id: "align-cv", selector: '[data-tour="align-cv"]', title: "Start with your CV", description: "Upload it so we can compare it against your BrandMoi profile.", placement: "bottom" },
  { id: "align-linkedin", selector: '[data-tour="align-linkedin"]', title: "Then your LinkedIn profile", description: "Upload the PDF export, or paste the text — whichever's easier.", placement: "bottom" },
];
