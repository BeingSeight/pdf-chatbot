import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { streamText } from "ai";
import {
  ConversationalRetrievalQAChain,
} from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import axios from "axios";

// Create a custom LangChainStream function to replace the missing import
function LangChainStream() {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const handlers = {
    handleLLMNewToken: async (token: string) => {
      await writer.ready;
      await writer.write(encoder.encode(`${token}`));
    },
    handleChainEnd: async () => {
      await writer.ready;
      await writer.close();
    },
    handleChainError: async (e: Error) => {
      await writer.ready;
      await writer.abort(e);
    },
  };

  return { stream: stream.readable, handlers };
}

export async function POST(request: NextRequest) {
  try {
    // Parse the POST request's JSON body
    const body = await request.json();

    // Set up streaming
    const { stream, handlers } = LangChainStream();

    // Initialize Pinecone Client
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

    // Initialize OpenAI embeddings via OpenRouter using the configuration approach
    const openAIEmbeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-ada-002",
      openAIApiKey: process.env.OPENROUTER_API_KEY!,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultQuery: {
          route: "openai",
        },
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "PDF Chatbot",
        },
      },
    });

    // Initialize vector store with OpenAI embeddings
    const vectorStore = await PineconeStore.fromExistingIndex(
      openAIEmbeddings,
      {
        pineconeIndex: index,
        namespace: "pdf-documents",
      }
    );

    // Create ChatOpenAI model using OpenRouter
    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo", // Updated model name for OpenRouter
      temperature: 0.7,
      streaming: true,
      callbacks: [handlers],
      openAIApiKey: process.env.OPENROUTER_API_KEY!,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "PDF Chatbot",
        },
      },
    });

    // Create a conversation chain with memory
    const chain = ConversationalRetrievalQAChain.fromLLM(
      model,
      vectorStore.asRetriever(),
      {
        returnSourceDocuments: true,
        memory: new BufferMemory({
          memoryKey: "chat_history",
          inputKey: "question",
          outputKey: "text",
        }),
      }
    );

    // Process the user's question
    await chain.call({
      question: body.prompt,
    });

    // Return the streaming response
    // Since we can't use streamText directly, we'll use a more basic approach
    return new Response(stream);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Error processing your request" }, { status: 500 });
  }
}