'use server';

import { extractTextFromPDF } from '@/utils/pdf';

export async function processPDF(formData: FormData) {
  const file = formData.get('file') as File;
  
  if (!file || file.type !== 'application/pdf') {
    return { success: false, error: 'Invalid or missing PDF file' };
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const text = await extractTextFromPDF(buffer);
    
    return { 
      success: true, 
      text,
      pages: text.length > 0 ? Math.ceil(text.length / 3000) : 0 // Rough estimate
    };
  } catch (error) {
    console.error('Error in processPDF action:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error processing PDF'
    };
  }
}
