import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfImages {
  pages: string[];
  widths: number[];
  heights: number[];
}

/**
 * Renders every page of a PDF file to PNG data URLs.
 * Uses a 2x scale for sharpness on HiDPI displays.
 */
export async function pdfToImages(file: File, scale = 2): Promise<PdfImages> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  const widths: number[] = [];
  const heights: number[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    pages.push(canvas.toDataURL('image/png'));
    // Store intrinsic (1x) dimensions
    widths.push(viewport.width / scale);
    heights.push(viewport.height / scale);

    page.cleanup();
  }

  pdf.destroy();
  return { pages, widths, heights };
}
