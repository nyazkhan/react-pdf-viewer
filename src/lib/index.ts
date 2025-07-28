// Core components
export { PDFViewer } from './PDFViewer'
export { PDFPage } from './PDFPage'
export { PDFToolbar } from './PDFToolbar'
export { PDFSidebar } from './PDFSidebar'
export { PDFHighlight } from './PDFHighlight'

// Hooks
export { useKeyboardShortcuts } from './useKeyboardShortcuts'

// Worker utilities
export { 
  configurePDFWorker, 
  resetWorkerConfiguration, 
  isWorkerConfiguredProperly,
  getWorkerSrc,
  getWorkerRetryCount,
  retryWorkerConfiguration
} from './worker'

// PDF utilities
export {
  createHighlightsForText,
  extractDocumentInfo,
  searchTextInPage,
  getPageTextContent,
  downloadPDFFromUrl,
  createBlobUrl,
  cleanupBlobUrl,
  getWorkerInfo,
  testWorker,
  resetWorker,
  PDFUtils,
  SAMPLE_HIGHLIGHT_TEXTS,
  SAMPLE_PDF_URLS
} from './utils'

// Types from useKeyboardShortcuts
export type { KeyboardShortcutsHandlers } from './useKeyboardShortcuts'

// Types from types.ts
export type {
  PDFViewerProps,
  PDFPageProps,
  PDFToolbarProps,
  PDFSidebarProps,
  PDFHighlightProps,
  PDFDocumentProxy,
  PDFPageProxy,
  PDFPageViewport,
  PDFRenderTask,
  PDFLoadingTask,
  PDFTextContent,
  PDFTextItem,
  PDFRenderContext,
  PDFOutlineItem,
  PDFAttachment,
  PDFDocumentInfo,
  PDFRect,
  ToolbarTool,
  ViewMode,
  SidebarView,
  ZoomMode
} from './types'

// Highlight type - exported separately to avoid duplicate identifier
export type { PDFHighlight as PDFHighlightType } from './types'

// Re-export PDF.js types for convenience
export type * from 'pdfjs-dist'

// Default export
export { PDFViewer as default } from './PDFViewer' 