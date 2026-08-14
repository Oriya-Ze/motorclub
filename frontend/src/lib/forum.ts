export interface ForumSummary {
  id: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  icon?: string;
  topics_count: number;
}

export function forumName(forum: Pick<ForumSummary, "name" | "name_en">, language: string) {
  if (language.startsWith("en") && forum.name_en) return forum.name_en;
  return forum.name;
}

export function forumDescription(
  forum: Pick<ForumSummary, "description" | "description_en">,
  language: string
) {
  if (language.startsWith("en") && forum.description_en) return forum.description_en;
  return forum.description;
}
