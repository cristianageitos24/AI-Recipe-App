/**
 * Formats a recipe title with max 2 words per line.
 * Limits to 3 lines and adds "..." if the title is longer.
 */
export function formatRecipeTitleTwoWordsPerLine(title: string, maxLines = 3): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const maxWords = maxLines * 2;
  const displayWords = words.slice(0, maxWords);
  const hasMore = words.length > maxWords;
  const lines: string[] = [];
  for (let i = 0; i < displayWords.length; i += 2) {
    lines.push(displayWords.slice(i, i + 2).join(" "));
  }
  let result = lines.join("\n");
  if (hasMore) result += "...";
  return result;
}
