import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaptureForm,
  ResultView,
} from "./Capture";
import {
  EMPTY_MOMENT_DETAILS,
  HUMANISE_ACTIONS,
  type MomentDetails,
} from "@/lib/humanisation";
import type { GeneratedContent } from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", () => ({
  useExploreDirections: () => ({ mutate: vi.fn(), isPending: false }),
  useGetPerformanceInsights: () => ({ data: undefined }),
}));

afterEach(() => {
  cleanup();
});

function renderCaptureForm(
  momentDetails: MomentDetails = EMPTY_MOMENT_DETAILS,
  rawInput = "Our difficult client conversation changed our approach.",
) {
  const onMakeIt = vi.fn();
  const props = {
    rawInput,
    setRawInput: vi.fn(),
    momentDetails,
    setMomentDetails: vi.fn(),
    audience: "Peers",
    setAudience: vi.fn(),
    feeling: "Direct",
    setFeeling: vi.fn(),
    tieToNews: false,
    setTieToNews: vi.fn(),
    isGenerating: false,
    onMakeIt,
    onSelectDirection: vi.fn(),
    error: null,
  };

  render(<CaptureForm {...props} />);
  return { onMakeIt, setMomentDetails: props.setMomentDetails };
}

function resultViewProps(
  momentDetails: MomentDetails = EMPTY_MOMENT_DETAILS,
  rawIdea = "An idea without extra detail.",
) {
  const content = {
    post: "A generated post.",
    shortPost: "",
    carousel: [],
    visual: "",
    infographic: null,
    illustration: null,
    hashtags: "",
    alternativeHooks: [],
  } as unknown as GeneratedContent;

  return {
    content,
    editedPost: content.post,
    setEditedPost: vi.fn(),
    hashtags: "",
    setHashtags: vi.fn(),
    versions: [],
    onRestoreVersion: vi.fn(),
    activeTab: "post" as const,
    setActiveTab: vi.fn(),
    visualStyle: "new-yorker",
    setVisualStyle: vi.fn(),
    visualImage: null,
    isLoadingVisual: false,
    illustrationImage: null,
    illustrationCaption: "",
    illustrationScene: "",
    isLoadingIllustration: false,
    fullPost: content.post,
    rawIdea,
    momentDetails,
    brandClosingMode: "never" as const,
    brandClosingText: "",
    brandClosingApplied: false,
    onToggleBrandClosing: vi.fn(),
    audience: "Peers",
    feeling: "Direct",
    isRefining: false,
    isSaving: false,
    isCheckingAuthenticity: false,
    isDemo: false,
    onSwapHook: vi.fn(),
    onRefine: vi.fn(),
    onTryAgain: vi.fn(),
    onChangeFeeling: vi.fn(),
    onChangeVisualStyle: vi.fn(),
    setIllustrationCaption: vi.fn(),
    setIllustrationScene: vi.fn(),
    onGenerateIllustration: vi.fn(),
    onRegenIllustration: vi.fn(),
    onGenerateVisual: vi.fn(),
    onSave: vi.fn(),
    onCopy: vi.fn(),
    onBrandReview: vi.fn(),
    isBrandReviewLoading: false,
    hasCachedBrandReview: false,
    brandReviewIsStale: false,
  };
}

describe("Capture humanisation flow", () => {
  it("keeps the specificity prompt non-blocking", () => {
    const { onMakeIt } = renderCaptureForm();
    const makeIt = screen.getByRole("button", { name: "Make it" });

    expect(screen.queryByTestId("prompt-specificity-check")).not.toBeNull();
    expect(makeIt.hasAttribute("disabled")).toBe(false);

    fireEvent.click(makeIt);

    expect(onMakeIt).toHaveBeenCalledWith({
      rawInput: "Our difficult client conversation changed our approach.",
      moment: EMPTY_MOMENT_DETAILS,
    });
  });

  it("sends only captured moment fields after Make it is clicked", () => {
    const { onMakeIt } = renderCaptureForm({
      ...EMPTY_MOMENT_DETAILS,
      scene: "In a client call on Thursday afternoon",
      changed: "We stopped solving the wrong problem",
    });

    fireEvent.click(screen.getByRole("button", { name: "Make it" }));

    const generationInput = onMakeIt.mock.calls[0][0].rawInput;
    expect(generationInput).toContain("Human detail provided by the author:");
    expect(generationInput).toContain(
      "Specific moment or scene: In a client call on Thursday afternoon",
    );
    expect(generationInput).toContain(
      "What changed or what I learned: We stopped solving the wrong problem",
    );
    expect(generationInput).not.toContain("What was at stake or went wrong:");
    expect(generationInput).not.toContain("What I did:");
  });
});

describe("ResultView humanisation details", () => {
  it("shows a clear empty state when no extra details were captured", () => {
    render(<ResultView {...resultViewProps(EMPTY_MOMENT_DETAILS, "")} />);

    expect(screen.getByTestId("panel-details-used")).not.toBeNull();
    expect(screen.getByTestId("text-details-used-empty")).not.toBeNull();
    expect(screen.queryByTestId("text-detail-used-scene")).toBeNull();
  });

  it("shows captured idea and moment details in the Details used panel", () => {
    const momentDetails = {
      ...EMPTY_MOMENT_DETAILS,
      scene: "At the kitchen table before the meeting",
    };
    render(
      <ResultView
        {...resultViewProps(momentDetails, "We changed how we ran the meeting.")}
      />,
    );

    expect(screen.getByTestId("text-detail-used-idea").textContent).toContain(
      "We changed how we ran the meeting.",
    );
    expect(screen.getByTestId("text-detail-used-scene").textContent).toContain(
      "At the kitchen table before the meeting",
    );
    expect(screen.queryByTestId("text-details-used-empty")).toBeNull();
  });

  it("routes every humanise action through the existing refine callback", () => {
    const props = resultViewProps();
    render(<ResultView {...props} />);

    for (const action of HUMANISE_ACTIONS) {
      fireEvent.click(screen.getByTestId(`button-humanise-${action.key}`));
      expect(props.onRefine).toHaveBeenLastCalledWith(
        action.instruction,
        "post",
        action.label,
      );
    }

    expect(props.onRefine).toHaveBeenCalledTimes(HUMANISE_ACTIONS.length);
  });
});