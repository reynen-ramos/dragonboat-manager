/**
 * Handing the user a file.
 *
 * Kept apart from `csv.ts` so that module stays free of DOM calls: it is
 * otherwise pure, and the domain-layer test project runs without a browser.
 */
export function downloadTextFile(filename: string, text: string, mime = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Firefox ignores a click on an anchor that is not in the document.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoking in the same tick can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
