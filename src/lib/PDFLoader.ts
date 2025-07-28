import * as pdfjsLib from 'pdfjs-dist'
import { retryWorkerConfiguration, getWorkerSrc } from './worker'
import type { PDFDocumentProxy, PDFLoadingTask } from './types'

interface PDFLoadOptions {
  file: string | File | ArrayBuffer | Uint8Array
  retries?: number
  timeout?: number
}

interface PDFLoadResult {
  pdf: PDFDocumentProxy | null
  error: Error | null
  retriesUsed: number
}

/**
 * Robust PDF loader with retry logic and worker failure handling
 */
export class PDFLoader {
  private static readonly DEFAULT_RETRIES = 3
  private static readonly DEFAULT_TIMEOUT = 30000 // 30 seconds
  
  /**
   * Load PDF with automatic retry on worker failures
   */
  static async loadPDF(options: PDFLoadOptions): Promise<PDFLoadResult> {
    const { file, retries = this.DEFAULT_RETRIES, timeout = this.DEFAULT_TIMEOUT } = options
    let lastError: Error | null = null
    let retriesUsed = 0

    for (let attempt = 0; attempt <= retries; attempt++) {
             try {
         console.log(`PDF Load attempt ${attempt + 1}/${retries + 1}, worker: ${getWorkerSrc()}`)
         
         // Create loading task
         const loadingTask = await this.createLoadingTask(file)
         
         // Add timeout to the loading task
         const pdf = await Promise.race([
           loadingTask.promise,
           new Promise<never>((_, reject) => 
             setTimeout(() => reject(new Error('PDF loading timeout')), timeout)
           )
         ])

        console.log('PDF loaded successfully')
        return { pdf, error: null, retriesUsed: attempt }
        
             } catch (error) {
         retriesUsed = attempt + 1
         lastError = error instanceof Error ? error : new Error(String(error))
         
         console.warn(`PDF load attempt ${attempt + 1} failed:`, lastError.message)
         
         // Check if it's a worker-related error
         if (this.isWorkerError(lastError) && attempt < retries) {
           console.log('Worker error detected, trying alternative worker...')
           
           // Wait a bit before retrying
           await new Promise(resolve => setTimeout(resolve, 1000))
           
           // Try to configure a different worker
           const retrySuccess = retryWorkerConfiguration()
           if (!retrySuccess) {
             console.warn('No more worker fallbacks available')
             break
           }
           
           // Wait a bit more for worker to initialize
           await new Promise(resolve => setTimeout(resolve, 1000))
         } else if (attempt < retries) {
           // Non-worker error, still retry but with shorter delay
           await new Promise(resolve => setTimeout(resolve, 500))
         }
       }
     }

     // If all attempts failed, try one more time with a fresh worker reset
     if (!lastError || this.isWorkerError(lastError)) {
       console.log('All attempts failed, trying complete worker reset...')
       try {
         // Import reset function to avoid circular dependency
         const { resetWorkerConfiguration } = await import('./worker')
         resetWorkerConfiguration()
         
         // Give more time for complete reset and reconfiguration
         await new Promise(resolve => setTimeout(resolve, 2000))
         
         // One final attempt
         const loadingTask = await this.createLoadingTask(file)
         const pdf = await Promise.race([
           loadingTask.promise,
           new Promise<never>((_, reject) => 
             setTimeout(() => reject(new Error('Final attempt timeout')), 15000)
           )
         ])
         
         console.log('PDF loaded successfully after complete worker reset')
         return { pdf, error: null, retriesUsed: retriesUsed + 1 }
       } catch (finalError) {
         console.error('Final attempt after worker reset also failed:', finalError)
         lastError = finalError instanceof Error ? finalError : new Error(String(finalError))
      }
    }

    return { pdf: null, error: lastError, retriesUsed }
  }

     /**
    * Create PDF loading task based on file type
    */
   private static async createLoadingTask(file: string | File | ArrayBuffer | Uint8Array): Promise<PDFLoadingTask> {
     if (typeof file === 'string') {
       // URL
       return pdfjsLib.getDocument({
         url: file,
         // Add some additional options for better reliability
         stopAtErrors: false,
         maxImageSize: 1024 * 1024, // 1MB max image size
         cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
         cMapPacked: true,
       })
     } else if (file instanceof File) {
       // File object - convert to ArrayBuffer
       const arrayBuffer = await file.arrayBuffer()
       return pdfjsLib.getDocument({
         data: arrayBuffer,
         stopAtErrors: false,
       })
     } else {
       // ArrayBuffer or Uint8Array
       return pdfjsLib.getDocument({
         data: file,
         stopAtErrors: false,
       })
     }
   }

  /**
   * Check if an error is related to worker issues
   */
  private static isWorkerError(error: Error): boolean {
    const workerErrorKeywords = [
      'worker',
      'terminated',
      'destroyed',
      'Worker',
      'Transport destroyed',
      'Cannot resolve module',
      'Failed to fetch',
      'NetworkError',
      'CORS',
      'Invalid `workerSrc`',
      'workerSrc',
    ]

    return workerErrorKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    )
  }

  /**
   * Preload worker to check if it's working
   */
  static async testWorker(): Promise<boolean> {
    try {
      // Try to load a minimal PDF to test the worker
      const testPdfData = new Uint8Array([
        37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10, 49, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 84, 121, 112, 101, 32, 47, 67, 97, 116, 97, 108, 111, 103, 10, 47, 80, 97, 103, 101, 115, 32, 50, 32, 48, 32, 82, 10, 62, 62, 10, 101, 110, 100, 111, 98, 106, 10, 50, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 84, 121, 112, 101, 32, 47, 80, 97, 103, 101, 115, 10, 47, 75, 105, 100, 115, 32, 91, 51, 32, 48, 32, 82, 93, 10, 47, 67, 111, 117, 110, 116, 32, 49, 10, 62, 62, 10, 101, 110, 100, 111, 98, 106, 10, 51, 32, 48, 32, 111, 98, 106, 10, 60, 60, 10, 47, 84, 121, 112, 101, 32, 47, 80, 97, 103, 101, 10, 47, 80, 97, 114, 101, 110, 116, 32, 50, 32, 48, 32, 82, 10, 47, 77, 101, 100, 105, 97, 66, 111, 120, 32, 91, 48, 32, 48, 32, 54, 49, 50, 32, 55, 57, 50, 93, 10, 62, 62, 10, 101, 110, 100, 111, 98, 106, 10, 120, 114, 101, 102, 10, 48, 32, 52, 10, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 32, 54, 53, 53, 51, 53, 32, 102, 32, 10, 48, 48, 48, 48, 48, 48, 48, 48, 49, 53, 32, 48, 48, 48, 48, 48, 32, 110, 32, 10, 48, 48, 48, 48, 48, 48, 48, 48, 55, 52, 32, 48, 48, 48, 48, 48, 32, 110, 32, 10, 48, 48, 48, 48, 48, 48, 48, 49, 50, 49, 32, 48, 48, 48, 48, 48, 32, 110, 32, 10, 116, 114, 97, 105, 108, 101, 114, 10, 60, 60, 10, 47, 83, 105, 122, 101, 32, 52, 10, 47, 82, 111, 111, 116, 32, 49, 32, 48, 32, 82, 10, 62, 62, 10, 115, 116, 97, 114, 116, 120, 114, 101, 102, 10, 49, 55, 56, 10, 37, 37, 69, 79, 70
      ])

      const loadingTask = pdfjsLib.getDocument({ data: testPdfData })
      const testPdf = await Promise.race([
        loadingTask.promise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Worker test timeout')), 5000)
        )
      ])

      await testPdf.destroy()
      return true
    } catch (error) {
      console.warn('Worker test failed:', error)
      return false
    }
  }
} 