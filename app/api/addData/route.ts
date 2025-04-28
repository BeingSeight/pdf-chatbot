import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import axios from "axios";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import pdfParse from "pdf-parse";

// Custom embeddings class for OpenRouter
class OpenRouterEmbeddings implements Embeddings {
  apiKey: string;
  caller: AsyncCaller;
  batchSize: number;

  constructor(apiKey: string, batchSize: number = 10) {
    this.apiKey = apiKey;
    this.batchSize = batchSize;
    this.caller = new AsyncCaller({
      maxConcurrency: 5,
      maxRetries: 3,
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      // Process in batches to avoid overwhelming the API
      const batches = [];
      for (let i = 0; i < texts.length; i += this.batchSize) {
        batches.push(texts.slice(i, i + this.batchSize));
      }
      
      console.log(`Processing ${texts.length} documents in ${batches.length} batches`);
      
      const batchResults = [];
      for (const batch of batches) {
        // Process each batch serially to avoid rate limits
        const batchResult = await Promise.all(
          batch.map(text => this.embedQuery(text).catch(e => {
            console.error(`Error embedding text: ${e.message}`);
            // Return a zero vector as fallback (with appropriate dimension)
            // Using a size of 1536 which is standard for text-embedding-ada-002
            return new Array(1536).fill(0);
          }))
        );
        batchResults.push(...batchResult);
      }
      
      return batchResults;
    } catch (error: any) {
      console.error("Error embedding documents:", error);
      throw new Error(`Failed to embed documents: ${error.message}`);
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    // Skip empty text to avoid API errors
    if (!text || text.trim() === '') {
      console.warn("Skipping empty text for embedding");
      return new Array(1536).fill(0);
    }
    
    // Limit text length to avoid token limit issues
    const trimmedText = text.length > 8000 ? text.substring(0, 8000) : text;
    
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        const response = await axios.post(
          "https://openrouter.ai/api/v1/embeddings",
          {
            model: "openai/text-embedding-ada-002",
            input: trimmedText,
            route: "openai" // Add route parameter for proper routing
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "HTTP-Referer": "http://localhost:3000", // Your domain
              "X-Title": "PDF Chatbot",
              "Content-Type": "application/json",
            },
            timeout: 60000, // 60 second timeout
          }
        );

        if (!response.data?.data?.[0]?.embedding) {
          throw new Error("Invalid response format from OpenRouter API");
        }

        return response.data.data[0].embedding;
      } catch (error: any) {
        console.error(`Error in embedQuery (attempt ${retries + 1}/${maxRetries + 1}):`, error.message);
        
        if (axios.isAxiosError(error)) {
          if (error.response) {
            console.error("Response data:", error.response.data);
            console.error("Response status:", error.response.status);
            
            // Rate limiting or server error - retry
            if (error.response.status === 429 || error.response.status >= 500) {
              retries++;
              if (retries <= maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, retries) * 1000;
                console.log(`Retrying after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
          }
        }
        
        // If we've exhausted retries or it's not a retriable error, throw
        if (retries >= maxRetries) {
          throw new Error(`Failed to embed text after ${maxRetries + 1} attempts: ${error.message}`);
        } else {
          throw error;
        }
      }
    }
    
    // This should never be reached due to the throw in the loop, but TypeScript needs it
    throw new Error("Unexpected error in embedQuery");
  }
}

export async function POST(request: NextRequest) {
  console.log("API route called: /api/addData");
  try {
    // Check environment variables
    console.log("Checking environment variables...");
    if (!process.env.PINECONE_API_KEY) {
      console.error("Missing PINECONE_API_KEY environment variable");
      return NextResponse.json({ 
        success: false, 
        error: "Server configuration error: Missing Pinecone API Key" 
      }, { status: 500 });
    } else {
      // Log first few characters to verify it's loaded (don't log full key)
      console.log(`PINECONE_API_KEY is set: ${process.env.PINECONE_API_KEY.substring(0, 5)}...`);
    }
    
    if (!process.env.PINECONE_INDEX_NAME) {
      console.error("Missing PINECONE_INDEX_NAME environment variable");
      return NextResponse.json({ 
        success: false, 
        error: "Server configuration error: Missing Pinecone Index Name" 
      }, { status: 500 });
    } else {
      console.log(`PINECONE_INDEX_NAME: ${process.env.PINECONE_INDEX_NAME}`);
    }
    
    if (!process.env.OPENROUTER_API_KEY) {
      console.error("Missing OPENROUTER_API_KEY environment variable");
      return NextResponse.json({ 
        success: false, 
        error: "Server configuration error: Missing OpenRouter API Key" 
      }, { status: 500 });
    } else {
      // Log first few characters to verify it's loaded (don't log full key)
      console.log(`OPENROUTER_API_KEY is set: ${process.env.OPENROUTER_API_KEY.substring(0, 5)}...`);
    }
    
    // Extract FormData from the request
    console.log("Extracting form data...");
    let data;
    try {
      data = await request.formData();
    } catch (error) {
      console.error("Failed to parse form data:", error);
      return NextResponse.json({ 
        success: false, 
        error: "Invalid form data"
      }, { status: 400 });
    }
    
    // Extract the uploaded file from the FormData
    const file = data.get("file") as File | null;
    console.log("Received file:", file ? file.name : "No file", "Type:", file?.type);

    // Make sure file exists
    if (!file) {
      return NextResponse.json({ success: false, error: "No file found" }, { status: 400 });
    }

    // Make sure file is a PDF
    if (file.type !== "application/pdf") {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid file type: ${file.type}. Expected: application/pdf` 
      }, { status: 400 });
    }

    console.log("Loading PDF file:", file.name, "Size:", file.size, "bytes");
    
    // File size validation
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({
        success: false,
        error: "PDF file too large. Maximum size is 10MB."
      }, { status: 400 });
    }
    
    try {
      // Convert File to a Buffer
      let fileBuffer;
      try {
        // Use a more direct approach to get binary data
        const arrayBuffer = await file.arrayBuffer();
        console.log("ArrayBuffer obtained, size:", arrayBuffer.byteLength);
        
        // Create buffer directly from ArrayBuffer for better compatibility
        fileBuffer = Buffer.from(arrayBuffer);
        console.log("Buffer created, size:", fileBuffer.length);
        
        if (fileBuffer.length === 0) {
          console.error("Empty buffer created");
          return NextResponse.json({
            success: false,
            error: "Empty PDF file uploaded"
          }, { status: 400 });
        }
      } catch (error) {
        // Type guard for the error
        const bufferError = error as Error;
        console.error("Failed to create buffer from file:", bufferError);
        return NextResponse.json({
          success: false,
          error: `Error processing file: ${bufferError.message || "Unknown error"}`
        }, { status: 500 });
      }
      
      // Parse the PDF file
      let pdfData;
      try {
        console.log("Starting PDF parsing...");
        
        // Simplified parsing with minimal options
        pdfData = await pdfParse(fileBuffer, {
          max: 0  // Parse all pages
        });
        
        console.log("PDF parsed, pages:", pdfData.numpages, "text length:", pdfData.text?.length || 0);
        
        if (!pdfData.text || pdfData.text.length < 10) {
          console.error("PDF parsing returned empty or very short text");
          return NextResponse.json({
            success: false,
            error: "The PDF appears to be empty or contains too little text. It may be scan-based or have restricted permissions."
          }, { status: 400 });
        }
      } catch (error) {
        // Type guard for the error
        const pdfError = error as Error;
        console.error("Error parsing PDF:", pdfError);
        
        return NextResponse.json({
          success: false,
          error: `Failed to parse PDF: ${pdfError.message || "Unknown error"}`
        }, { status: 400 });
      }

      // Create document object from PDF data
      const rawDocs: Document[] = [new Document({ pageContent: pdfData.text })];

      // Split text into chunks
      console.log("Splitting document into chunks");
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
      });
      
      const docs = await textSplitter.splitDocuments(rawDocs);
      console.log("Documents split into chunks:", docs.length);
      
      if (docs.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Failed to split document into chunks"
        }, { status: 500 });
      }

      // Initialize the Pinecone client
      console.log("Initializing Pinecone");
      let pinecone;
      try {
        pinecone = new Pinecone({
          apiKey: process.env.PINECONE_API_KEY!,
        });
      } catch (pineconeError) {
        console.error("Failed to initialize Pinecone client:", pineconeError);
        return NextResponse.json({
          success: false,
          error: "Failed to connect to Pinecone database"
        }, { status: 500 });
      }

      let pineconeIndex;
      try {
        pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
      } catch (indexError) {
        console.error("Failed to get Pinecone index:", indexError);
        return NextResponse.json({
          success: false,
          error: "Failed to access Pinecone index"
        }, { status: 500 });
      }

      // Use our custom embeddings class
      console.log("Creating embeddings with OpenRouter");
      const embeddings = new OpenRouterEmbeddings(
        process.env.OPENROUTER_API_KEY!,
        5 // Smaller batch size for improved reliability
      );

      // Store embeddings in Pinecone
      console.log("Storing embeddings in Pinecone");
      try {
        await PineconeStore.fromDocuments(
          docs, 
          embeddings, 
          { 
            pineconeIndex,
            namespace: "pdf-documents" 
          }
        );
      } catch (storeError: any) {
        console.error("Failed to store embeddings in Pinecone:", storeError);
        return NextResponse.json({
          success: false,
          error: `Failed to store document in vector database: ${storeError.message || String(storeError)}`
        }, { status: 500 });
      }

      console.log("Documents successfully stored in Pinecone");
      return NextResponse.json({ success: true });
    } catch (innerError: any) {
      console.error("PDF processing error:", innerError);
      return NextResponse.json({ 
        success: false, 
        error: `Error processing PDF: ${innerError.message || String(innerError)}` 
      }, { status: 500 });
    }
  } catch (outerError: any) {
    console.error("Request handling error:", outerError);
    return NextResponse.json({ 
      success: false, 
      error: `Server error: ${outerError.message || String(outerError)}` 
    }, { status: 500 });
  }
}