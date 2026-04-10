/** Shared props for outbound recipe source links (RecipeFullView: left column + View source). */
export function getRecipeSourceLinkBase(websiteUrl: string) {
  const href = websiteUrl.trim();
  return {
    href,
    target: "_blank" as const,
    rel: "noopener noreferrer" as const,
  };
}

export function getRecipeSourceColumnAriaLabel(recipeLabel: string): string {
  return `Open recipe source for ${recipeLabel}`;
}
