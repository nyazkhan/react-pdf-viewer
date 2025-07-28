import * as pdfjsLib from 'pdfjs-dist'

// Track if worker has been configured to prevent multiple configurations
let isWorkerConfigured = false
let workerRetryCount = 0
const MAX_WORKER_RETRIES = 3

/**
 * Configure PDF.js worker source with retry logic
 * Call this before using any PDF components
 */
export const configurePDFWorker = (workerSrc?: string, force = false) => {
  // Prevent multiple configurations unless forced
  if (isWorkerConfigured && !force) {
    return
  }

  // Clear any existing worker configuration
  if (force) {
    try {
      // Clear the worker source properly
      delete (pdfjsLib.GlobalWorkerOptions as any).workerSrc
    } catch (error) {
      console.warn('Error clearing existing worker:', error)
    }
  }

  if (workerSrc && workerSrc.trim()) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
  } else if (!pdfjsLib.GlobalWorkerOptions.workerSrc || pdfjsLib.GlobalWorkerOptions.workerSrc === '') {
    // Try multiple CDN options as fallbacks
    const fallbackWorkers = [
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`,
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`,
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    ]
    
    // Use the first available worker based on retry count
    const workerIndex = workerRetryCount % fallbackWorkers.length
    pdfjsLib.GlobalWorkerOptions.workerSrc = fallbackWorkers[workerIndex]
    
    console.log(`Configuring PDF worker (attempt ${workerRetryCount + 1}):`, pdfjsLib.GlobalWorkerOptions.workerSrc)
  }
  
  isWorkerConfigured = true
}

/**
 * Get the current worker configuration
 */
export const getWorkerSrc = () => pdfjsLib.GlobalWorkerOptions.workerSrc

/**
 * Common worker configurations
 */
export const WorkerSources = {
  // Local worker (copy pdf.worker.min.mjs to your public directory)
  LOCAL: '/pdf.worker.min.js',
  
  // jsDelivr CDN (recommended - more reliable)
  JSDELIVR: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`,
  
  // unpkg CDN (alternative)
  UNPKG: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`,
  
  // Mozilla CDN (if available)
  MOZILLA: `https://mozilla.github.io/pdf.js/build/pdf.worker.mjs`,
} as const

/**
 * Reset worker configuration (useful for troubleshooting)
 */
export const resetWorkerConfiguration = () => {
  isWorkerConfigured = false
  workerRetryCount = 0
  // Clear worker source properly to avoid "Invalid workerSrc type" error
  try {
    delete (pdfjsLib.GlobalWorkerOptions as any).workerSrc
  } catch (error) {
    // If delete fails, set to empty string as fallback
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''
  }
  // Reconfigure with default
  configurePDFWorker(undefined, true)
}

/**
 * Retry worker configuration with next fallback
 */
export const retryWorkerConfiguration = () => {
  if (workerRetryCount < MAX_WORKER_RETRIES) {
    workerRetryCount++
    isWorkerConfigured = false
    configurePDFWorker(undefined, true)
    return true
  }
  return false
}

/**
 * Check if worker is properly configured
 */
export const isWorkerConfiguredProperly = () => {
  const workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc
  return !!(workerSrc && workerSrc.trim() && workerSrc !== 'undefined') && isWorkerConfigured
}

/**
 * Get current retry count for debugging
 */
export const getWorkerRetryCount = () => workerRetryCount

// Auto-configure on import with fallback
configurePDFWorker() 