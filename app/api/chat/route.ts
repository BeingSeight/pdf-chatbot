import { NextRequest, NextResponse } from "next/server";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { StreamingTextResponse } from "ai";
import { createStreamableValue } from "ai/rsc";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    // Create a streaming response value
    const { value, writable, readable } = createStreamableValue();
    
    // Initialize Pinecone
    const pinecone = new PineconeClient();
    await pinecone.init({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!
    });
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    
    // Setup vector store
    const vectorStore = await PineconeStore.fromExistingIndex(
      new HuggingFaceInferenceEmbeddings({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        apiKey: process.env.HUGGINGFACE_API_TOKEN!,
      }),
      { pineconeIndex: index, namespace: "pdf-documents" }
    );
    
    // Create retriever
    const retriever = vectorStore.asRetriever();
    
    // Setup HuggingFace model
    const model = new HuggingFaceInference({
      model: "google/flan-t5-xl",
      apiKey: process.env.HUGGINGFACE_API_TOKEN!,
      streaming: true,
    });
    
    // Create prompt template
    const promptTemplate = PromptTemplate.fromTemplate(
      `Answer the question based only on the following context:
      
      Context: {context}
      
      Question: {question}
      
      Answer:`
    );
    
    // Create a chain using RunnableSequence
    const chain = RunnableSequence.from([
      {
        context: retriever.pipe(formatDocumentsAsString),
        question: (input) => input.question,
      },
      promptTemplate,
      model,
      new StringOutputParser(),
    ]);
    
    // Process the chain and handle the streaming response
    const runnable = await chain.invoke({ question: prompt });
    const writer = writable.getWriter();
    writer.write(runnable);
    writer.close();
    
    // Return the streaming response
    return new StreamingTextResponse(readable);
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "An error occurred during processing" }, 
      { status: 500 }
    );
  }
}