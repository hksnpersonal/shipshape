/** Join class names, dropping anything falsy. Kept apart from components so fast refresh works. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
