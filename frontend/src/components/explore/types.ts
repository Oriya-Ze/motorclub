export type ExploreTab = "photos" | "vehicles" | "tags";

export const EXPLORE_TABS: ExploreTab[] = ["photos", "vehicles", "tags"];

export function parseExploreTab(value: string | null): ExploreTab {
  if (value === "vehicles" || value === "tags") return value;
  return "photos";
}
