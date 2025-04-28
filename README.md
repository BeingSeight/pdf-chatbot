# **PDF Chatbot – Chat with Any PDF using AI**
# [Click Here to Try PDF Chatbot Live](https://pdf-chatbot-beingseight.vercel.app/)

---
## Overview:
<img width="1408" alt="Screenshot of PDF Chatbot" src="https://github.com/user-attachments/assets/40d5b426-316a-48ca-bf48-e4c075856fd8" />


---
[GitHub Repository Link](https://github.com/BeingSeight/pdf-chatbot)

## **Introduction**

Welcome to **PDF Chatbot**! This interactive application lets you upload PDF documents and have conversations about their contents through AI. Built with Next.js, TypeScript, and Langchain, this application enables you to instantly query any PDF document without having to read through it manually. Simply upload your PDF, wait for processing, and start asking questions!

---

## **Features**

- **PDF Intelligence**: Upload PDFs and ask questions about their content instantly.  
- **Vector-Based Search**: Utilizes Pinecone vector database for semantic understanding of documents.  
- **Conversational Memory**: Maintains context throughout your conversation for more coherent answers.  
- **Modern Stack**: Built with Next.js App Router, TypeScript, and Tailwind CSS.  
- **Easy PDF Uploads**: Simple drag-and-drop interface for adding documents.

---

## **How It Works**

1. **Frontend**  
   - Built using **Next.js**, **TypeScript**, and **Tailwind CSS**.  
   - Features a drag-and-drop PDF uploader and interactive chat interface.  
2. **API Routes**  
   - `/api/addData`: Processes uploaded PDFs, extracts text, and stores embeddings in Pinecone.  
   - `/api/chat`: Handles user questions, retrieves relevant document sections, and generates AI responses.  
3. **Vector Storage**  
   - Uses **Pinecone** to store document embeddings for semantic retrieval.  
   - Creates vector representations of document chunks for accurate question answering.  
4. **Deployment**  
   - Hosted on **Vercel**, leveraging serverless functions for API endpoints.

---

## **Tech Stack**

- **Next.js**: Framework for React apps with built-in API routes.  
- **TypeScript**: Strongly-typed code for reliability and auto-completion.  
- **Tailwind CSS**: Utility-first CSS for sleek, responsive design.  
- **Langchain**: Framework for connecting AI models with external data sources.  
- **Pinecone**: Vector database for semantic document search.  
- **OpenAI**: GPT models for natural language understanding and generation.  
- **Vercel**: Zero-config deployment and serverless functions.

---

## **How I Built It**

1. **Project Setup**  
   - Created Next.js application with TypeScript and Tailwind CSS support.  
   - Configured environment variables for API keys and service connections.  
2. **Vector Database Integration**  
   - Set up Pinecone index with appropriate dimensions for OpenAI embeddings.  
   - Implemented document processing pipeline for PDF text extraction and chunking.  
3. **API Development**  
   - Built `/api/addData` endpoint to handle PDF uploads and vector storage.  
   - Created `/api/chat` endpoint with streaming response support for conversations.  
4. **Frontend Interface**  
   - Designed an intuitive upload area using react-dropzone.  
   - Implemented chat interface with real-time AI responses using Vercel's AI SDK.  
5. **Testing & Deployment**  
   - Tested with various PDF documents to ensure accurate information retrieval.  
   - Deployed to Vercel with proper environment configuration.

---

## **Why This Project Stands Out**

PDF Chatbot demonstrates how to build an **intelligent document interface** that bridges the gap between unstructured PDF data and conversational AI. By leveraging vector embeddings and retrieval-augmented generation, it provides accurate, contextual answers without hallucinating information not present in the documents.

---

## **Installation & Setup**

To run PDF Chatbot locally:

1. **Clone** the repository:
```bash
  git clone https://github.com/BeingSeight/pdf-chatbot.git
  cd pdf-chatbot
```
2. Install dependencies:
```bash
  npm install
```
3. Configure your environment variables:
Create .env.local:
``` env
  PINECONE_API_KEY="your_pinecone_key_here"
  PINECONE_INDEX_NAME="pdf-chatbot"
  OPENAI_API_KEY="your_openai_key_here"
```
4. Start the development server:
``` bash
  npm run dev
```
5. Open http://localhost:3000 in your browser.

---
## Deployment
1. Commit all changes (exclude .env.local) and push to GitHub.
2. Add all required environment variables in your Vercel project settings.
3. Deploy on Vercel to get a global, serverless PDF chatbot running in minutes.

---
## Acknowledgments
OpenAI for their powerful language models and embeddings API.

Pinecone for their efficient vector database technology.

Langchain, Next.js, TypeScript, and Tailwind CSS for an excellent development experience.

Feel free to explore, fork, and contribute to this project!