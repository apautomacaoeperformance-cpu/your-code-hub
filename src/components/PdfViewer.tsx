import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export function PdfViewer({ url, fileName }: { url: string; fileName?: string }) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState<number>(800);

  useEffect(() => {
    const updateWidth = () => {
      setWidth(Math.min(window.innerWidth * 0.7, 700));
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName || "documento.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup the temporary blob URL
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      // Fallback for different origins if fetch fails
      window.open(url, "_blank");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full justify-end px-4">
        <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
          Baixar arquivo
        </Button>
      </div>
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<div className="text-sm text-muted-foreground py-8">Carregando PDF…</div>}
        error={<div className="text-sm text-destructive py-8">Falha ao carregar PDF.</div>}
      >
        <Page pageNumber={page} width={width} renderTextLayer={false} renderAnnotationLayer={false} />
      </Document>
      {numPages > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <Button variant="outline" size="sm" className="h-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span>Página {page} de {numPages}</span>
          <Button variant="outline" size="sm" className="h-7" disabled={page >= numPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
