export interface ProductUpdateEntry {
  id: string;
  kind: "tour" | "whats-new";
  title: string;
  description: string;
}

// Append-only. Shipping a new feature = add one entry here — nothing else
// changes. The help icon goes "bold" whenever a user's lastSeenUpdateId
// isn't the last id in this list.
export const PRODUCT_UPDATES: ProductUpdateEntry[] = [
  {
    id: "welcome-tour",
    kind: "tour",
    title: "Welcome to BrandMoi",
    description: "A quick walkthrough of where to start.",
  },
  {
    id: "profile-alignment-launch",
    kind: "whats-new",
    title: "New: Profile Alignment",
    description: "Compare your CV, BrandMoi profile, and LinkedIn side by side to catch gaps and inconsistencies.",
  },
];

export const LATEST_UPDATE_ID = PRODUCT_UPDATES[PRODUCT_UPDATES.length - 1]!.id;

export function unseenUpdates(lastSeenUpdateId: string | null | undefined): ProductUpdateEntry[] {
  if (lastSeenUpdateId == null) return PRODUCT_UPDATES;
  const idx = PRODUCT_UPDATES.findIndex((u) => u.id === lastSeenUpdateId);
  return idx === -1 ? PRODUCT_UPDATES : PRODUCT_UPDATES.slice(idx + 1);
}
