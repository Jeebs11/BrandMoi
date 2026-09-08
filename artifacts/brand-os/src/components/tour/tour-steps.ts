export interface TourStep {
  id: string;
  selector: string;
  mobileSelector?: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
}

// All steps target Dashboard-visible nav entry points only, never a
// destination page — avoids cross-page navigation mid-tour entirely.
export const WELCOME_TOUR_STEPS: TourStep[] = [
  {
    id: "write-post",
    selector: '[data-tour="write-post"]',
    title: "Write your own post",
    description: "Already have an idea? Start here and go straight into the editor.",
    placement: "bottom",
  },
  {
    id: "idea-engine",
    selector: '[data-tour="idea-engine"]',
    title: "No idea yet? Try the Idea Engine",
    description: "Four lenses — your brand, teaching, your best-performing posts, and audience pain points — each turns into a draft with a tap.",
    placement: "top",
  },
  {
    id: "profile-alignment",
    selector: '[data-tour="profile-alignment"]',
    mobileSelector: '[data-tour="more-menu"]',
    title: "Keep your profile aligned",
    description: "Compare your CV, BrandMoi profile, and LinkedIn to spot gaps before you post.",
    placement: "right",
  },
  {
    id: "settings",
    selector: '[data-tour="settings"]',
    mobileSelector: '[data-tour="settings-mobile"]',
    title: "Tune your brand voice",
    description: "Adjust your role, audience, content pillars, and tone any time from Settings.",
    placement: "left",
  },
];
