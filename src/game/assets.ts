/** Public assets must respect the project subpath on GitHub Pages. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
