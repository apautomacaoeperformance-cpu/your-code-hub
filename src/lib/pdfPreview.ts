import type jsPDF from "jspdf";

export type PdfPreviewRequest = {
  bytes: Uint8Array;
  filename: string;
};

type Listener = (req: PdfPreviewRequest) => void;
const listeners = new Set<Listener>();

export function subscribePdfPreview(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Show a preview dialog for the generated PDF before download.
 * The user can confirm to download or cancel.
 */
export function previewPdf(doc: jsPDF, filename: string) {
  const buffer = doc.output("arraybuffer");
  listeners.forEach((fn) => fn({ bytes: new Uint8Array(buffer), filename }));
}
