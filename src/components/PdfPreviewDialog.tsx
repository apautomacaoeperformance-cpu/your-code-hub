import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { subscribePdfPreview, type PdfPreviewRequest } from "@/lib/pdfPreview";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export default function PdfPreviewDialog() {
  const { t } = useTranslation();
  const [req, setReq] = useState<PdfPreviewRequest | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const unsub = subscribePdfPreview((r) => setReq(r));
    return () => { unsub(); };
  }, []);

  const close = () => {
    setReq(null);
    setPages([]);
    setRenderError(false);
  };

  const confirm = () => {
    if (!req) return;
    const url = URL.createObjectURL(new Blob([toArrayBuffer(req.bytes)], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = req.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    close();
  };

  useEffect(() => {
    if (!req) return;
    let cancelled = false;

    async function renderPdf() {
      try {
        setPages([]);
        setRenderError(false);
        const pdf = await pdfjs.getDocument({ data: toArrayBuffer(req.bytes) }).promise;
        const renderedPages: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas context unavailable");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          renderedPages.push(canvas.toDataURL("image/png"));
          if (!cancelled) setPages([...renderedPages]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("PDF preview render failed", error);
          setRenderError(true);
        }
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [req]);

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-base">
            {t("pdfPreview.title", "Prévia do PDF")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {req?.filename} — {t("pdfPreview.description", "Revise o conteúdo antes de baixar.")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto bg-muted p-4">
          {req && pages.length === 0 && !renderError && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("pdfPreview.loading", "Carregando prévia...")}
            </div>
          )}
          {renderError && (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {t("pdfPreview.renderError", "Não foi possível renderizar a prévia, mas você ainda pode confirmar o download do PDF gerado.")}
            </div>
          )}
          {pages.length > 0 && (
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              {pages.map((page, index) => (
                <img
                  key={`${req?.filename}-${index}`}
                  src={page}
                  alt={t("pdfPreview.pageAlt", "Página {{page}} do PDF", { page: index + 1 })}
                  className="w-full rounded-md border bg-background shadow-sm"
                />
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="p-3 border-t gap-2 sm:gap-2">
          <Button variant="outline" onClick={close} className="gap-2">
            <X className="h-4 w-4" />
            {t("common.cancel", "Cancelar")}
          </Button>
          <Button onClick={confirm} className="gap-2">
            <Download className="h-4 w-4" />
            {t("pdfPreview.confirm", "Confirmar e baixar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
