"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useCompletion } from "ai/react";

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // When a file is dropped in the dropzone, call the `/api/addData` API to train our bot on a new PDF File
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF");
      return;
    }

    setIsUploading(true);
    setErrorDetails(null);
    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/addData", {
        method: "POST",
        body: formData,
      });

      // Get the raw text response regardless of content type
      const responseText = await response.text();
      let errorMessage = `Error: ${response.status} - ${response.statusText}`;
      
      try {
        // Try to parse as JSON to get detailed error
        const responseData = JSON.parse(responseText);
        if (!response.ok) {
          errorMessage += responseData.error ? `\nDetails: ${responseData.error}` : '';
          setErrorDetails(responseData.error || 'Unknown server error');
          throw new Error(errorMessage);
        }
        
        // Success case
        if (responseData.success) {
          alert("Data added successfully");
        } else {
          setErrorDetails(responseData.error || 'Unknown error');
          alert(responseData.error || "Unknown error occurred");
        }
      } catch (parseError) {
        // If parsing fails, it's likely HTML error page
        console.error("Failed to parse response:", parseError);
        setErrorDetails(responseText);
        throw new Error(`${errorMessage}\nRaw response: ${responseText.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload PDF: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Configure react-dropzone
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
  });

  // Vercel AI hook for generating completions through an AI model
  const { completion, input, isLoading, handleInputChange, handleSubmit } =
    useCompletion({
      api: "/api/chat",
    });

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div
        {...getRootProps({
          className:
            "dropzone bg-gray-900 border border-gray-800 p-10 rounded-md hover:bg-gray-800 transition-colors duration-200 ease-in-out cursor-pointer",
        })}
      >
        <input {...getInputProps()} />
        <p>{isUploading ? "Uploading PDF..." : "Upload a PDF to add new data"}</p>
      </div>

      {errorDetails && (
        <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-md w-full max-w-md">
          <h3 className="text-red-500 font-bold">Error Details:</h3>
          <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
            {errorDetails}
          </pre>
        </div>
      )}

      <div className="mx-auto w-full items-center max-w-md py-24 flex flex-col stretch">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            className="w-full max-w-md text-black border border-gray-300 rounded shadow-xl p-2"
            value={input}
            placeholder="Enter your prompt..."
            onChange={handleInputChange}
          />

          <button
            disabled={isLoading}
            type="submit"
            className="py-2 border rounded-lg bg-gray-900 text-sm px-6"
          >
            {isLoading ? "Thinking..." : "Submit"}
          </button>

          {completion && (
            <div className="border border-gray-800 p-4 rounded-lg bg-gray-900">
              <p>{completion}</p>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}