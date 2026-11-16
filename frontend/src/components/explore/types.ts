export type ExploreTab = "photos" | "vehicles" | "businesses";

export const EXPLORE_TABS: ExploreTab[] = ["photos", "vehicles", "businesses"];

export function parseExploreTab(value: string | null): ExploreTab {
  if (value === "vehicles" || value === "businesses") return value;
  return "photos";
}
