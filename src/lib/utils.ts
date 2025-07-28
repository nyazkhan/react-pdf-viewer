import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFHighlight, PDFRect } from './types'
import { 
  isWorkerConfiguredProperly, 
  getWorkerSrc, 
  getWorkerRetryCount,
  configurePDFWorker,
  resetWorkerConfiguration
} from './worker'

/**
 * Create highlights for text search across all pages of a PDF document
 * @param pdfDocument - The loaded PDF document
 * @param searchText - Text to search and highlight
 * @param color - Highlight color (default: '#ffff00')
 * @param opacity - Highlight opacity (default: 0.3)
 * @returns Array of highlight objects
 */
export async function createHighlightsForText(
  pdfDocument: PDFDocumentProxy,
  searchText: string,
  color: string = '#ffff00',
  opacity: number = 0.3
): Promise<PDFHighlight[]> {
  if (!pdfDocument || !searchText.trim()) {
    return []
  }

  const highlights: PDFHighlight[] = []
  
  try {
    // Search through all pages
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Combine all text items into a single string with position tracking
      let fullText = ''
      const textItems: any[] = []
      
      textContent.items.forEach((item: any) => {
        if (item.str && typeof item.str === 'string') {
          textItems.push({
            text: item.str,
            startIndex: fullText.length,
            endIndex: fullText.length + item.str.length,
            transform: item.transform,
            width: item.width,
            height: item.height
          })
          fullText += item.str
        }
      })
      
      // Search for the text (case-insensitive)
      const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      let match
      
      while ((match = searchRegex.exec(fullText)) !== null) {
        const startIndex = match.index
        const endIndex = startIndex + match[0].length
        
        // Find text items that contain this match
        const rects: PDFRect[] = []
        
        for (const textItem of textItems) {
          // Check if this text item overlaps with our match
          if (textItem.endIndex > startIndex && textItem.startIndex < endIndex) {
            const [scaleX, , , scaleY, translateX, translateY] = textItem.transform
            
            // Calculate the rectangle for this text item using PDF coordinates
            const fontSize = Math.abs(scaleY)
            const left = translateX
            const top = translateY
            const width = textItem.width || Math.abs(scaleX) * textItem.text.length
            const height = fontSize
            
            rects.push({
              left: left,
              top: top,
              width: width,
              height: height
            })
          }
        }
        
        if (rects.length > 0) {
          const highlight = {
            id: `highlight-${pageNum}-${startIndex}`,
            pageNumber: pageNum,
            rects: rects,
            color: color,
            opacity: opacity,
            content: match[0]
          }
          
          highlights.push(highlight)
        }
      }
    }
    
    console.log(`Found ${highlights.length} highlights for "${searchText}"`)
    return highlights
    
  } catch (error) {
    console.error('Error creating highlights:', error)
    return []
  }
}

/**
 * Extract document metadata and information
 * @param pdfDocument - The loaded PDF document
 * @returns Document information object
 */
export async function extractDocumentInfo(pdfDocument: PDFDocumentProxy) {
  try {
    const metadata = await pdfDocument.getMetadata()
    return {
      numPages: pdfDocument.numPages,
      fingerprints: pdfDocument.fingerprints,
      ...metadata.info
    }
  } catch (error) {
    console.error('Error extracting document info:', error)
    return null
  }
}

/**
 * Search for text in a specific page
 * @param pdfDocument - The loaded PDF document
 * @param pageNumber - Page number to search (1-based)
 * @param searchText - Text to search for
 * @returns Array of matches with position information
 */
export async function searchTextInPage(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  searchText: string
): Promise<Array<{ text: string, pageNumber: number, position: { x: number, y: number } }>> {
  if (!pdfDocument || !searchText.trim() || pageNumber < 1 || pageNumber > pdfDocument.numPages) {
    return []
  }

  try {
    const page = await pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const matches: Array<{ text: string, pageNumber: number, position: { x: number, y: number } }> = []
    
    let fullText = ''
    const textItems: any[] = []
    
    textContent.items.forEach((item: any) => {
      if (item.str && typeof item.str === 'string') {
        textItems.push({
          text: item.str,
          startIndex: fullText.length,
          endIndex: fullText.length + item.str.length,
          transform: item.transform
        })
        fullText += item.str
      }
    })
    
    const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    let match
    
    while ((match = searchRegex.exec(fullText)) !== null) {
      const startIndex = match.index
      
      // Find the text item that contains this match
      for (const textItem of textItems) {
        if (textItem.startIndex <= startIndex && textItem.endIndex > startIndex) {
          const [, , , , translateX, translateY] = textItem.transform
          matches.push({
            text: match[0],
            pageNumber: pageNumber,
            position: { x: translateX, y: translateY }
          })
          break
        }
      }
    }
    
    return matches
  } catch (error) {
    console.error('Error searching text in page:', error)
    return []
  }
}

/**
 * Get text content from a specific page
 * @param pdfDocument - The loaded PDF document
 * @param pageNumber - Page number (1-based)
 * @returns Plain text content of the page
 */
export async function getPageTextContent(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  if (!pdfDocument || pageNumber < 1 || pageNumber > pdfDocument.numPages) {
    return ''
  }

  try {
    const page = await pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    
    return textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .trim()
  } catch (error) {
    console.error('Error getting page text content:', error)
    return ''
  }
}

/**
 * Download PDF file from URL with CORS handling
 * @param url - PDF file URL
 * @returns File blob or null if failed
 */
export async function downloadPDFFromUrl(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/pdf,*/*'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const blob = await response.blob()
    
    // Validate PDF header
    const arrayBuffer = await blob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const header = String.fromCharCode(...uint8Array.slice(0, 4))
    
    if (header !== '%PDF') {
      throw new Error('Invalid PDF file: Missing PDF header')
    }
    
    return blob
  } catch (error) {
    console.error('Error downloading PDF:', error)
    return null
  }
}

/**
 * Create a blob URL from file data
 * @param file - File object or blob
 * @returns Blob URL string
 */
export function createBlobUrl(file: File | Blob): string {
  return URL.createObjectURL(file)
}

/**
 * Cleanup blob URL to free memory
 * @param url - Blob URL to cleanup
 */
export function cleanupBlobUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/**
 * Predefined sample texts for testing highlighting functionality
 */
export const SAMPLE_HIGHLIGHT_TEXTS = {
  traceMonkey: "r functions in order to verify that the call stack is refreshedat any point it needs to be used. In order to access the call stack,a function must be annotated as either FORCESSTACK or RE-QUIRESSTACK. These annotations are also required in order to callREQUIRESSTACK functions, which are presumed to access the callstack transitively. FORCESSTACK is a trusted annotation, appliedto only 5 functions, that means the function refreshes the call stack.REQUIRESSTACK is an untrusted a",
  
  title: "Trace-based Just-in-Time Type Specialization for Dynamic",
  
  introduction: "Dynamic languages such as JavaScript, Python, and Ruby, are popular since they are expressive, accessible to non-experts, and make deployment as easy as distributing a source file",
  
  compilation: "We present a trace-based compilation technique for dynamic languages that reconciles speed of compilation with excellent performance of the generated machine code"
} as const

/**
 * Sample PDF URLs for testing
 */
export const SAMPLE_PDF_URLS = {
  mozilla_tracemonkey: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
  local_tracemonkey: '/compressed.tracemonkey-pldi-09.pdf'
} as const

/**
 * Get current worker status and information
 * @returns Worker information object
 */
export function getWorkerInfo() {
  return {
    configured: isWorkerConfiguredProperly(),
    workerSrc: getWorkerSrc(),
    retryCount: getWorkerRetryCount()
  }
}

/**
 * Test PDF.js worker functionality
 * @returns Promise that resolves to test result
 */
export async function testWorker(): Promise<{ success: boolean, message: string }> {
  try {
    await configurePDFWorker()
    return { success: true, message: 'Worker test passed ✅' }
  } catch (error) {
    return { 
      success: false, 
      message: `Worker test failed: ${error instanceof Error ? error.message : 'Unknown error'} ❌` 
    }
  }
}

/**
 * Reset PDF.js worker configuration
 */
export function resetWorker(): void {
  resetWorkerConfiguration()
}

/**
 * Utility class for managing PDF operations
 */
export class PDFUtils {
  static createHighlights = createHighlightsForText
  static extractInfo = extractDocumentInfo
  static searchInPage = searchTextInPage
  static getPageText = getPageTextContent
  static downloadFromUrl = downloadPDFFromUrl
  static createBlobUrl = createBlobUrl
  static cleanupBlobUrl = cleanupBlobUrl
  static getWorkerInfo = getWorkerInfo
  static testWorker = testWorker
  static resetWorker = resetWorker
  static samples = {
    texts: SAMPLE_HIGHLIGHT_TEXTS,
    urls: SAMPLE_PDF_URLS
  }
} 