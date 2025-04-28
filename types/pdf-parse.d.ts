declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    version: string;
    numrender?: number;
    error?: Error | null;
  }

  interface PDFOptions {
    pagerender?: (pageData: any) => string | null;
    max?: number;
    version?: string;
    mode?: string;
    renderOpts?: Record<string, any>;
    internal?: boolean;
    throwOnEmpty?: boolean;
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  
  export = pdfParse;
}