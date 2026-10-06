import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Extracts plain text from a PDF Buffer using pdfjs-dist
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const pageTextPromises: Promise<string>[] = [];

    for (let i = 1; i <= numPages; i++) {
      pageTextPromises.push(
        doc.getPage(i).then(async (page) => {
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items
            .map((item: any) => item.str || "")
            .filter((str: string) => str.trim().length > 0);
          return `[Page ${i}]\n${pageStrings.join(" ")}`;
        }),
      );
    }

    const pages = await Promise.all(pageTextPromises);
    return pages.join("\n\n");
  } catch (error: any) {
    console.error("[PdfExtractor] Failed to extract text from PDF:", error);
    // Return empty or fallback
    return "";
  }
}
