// Components
export { PDFViewer } from './PDFViewer'
export { PDFToolbar } from './PDFToolbar'
export { PDFPage } from './PDFPage'
export { PDFHighlight } from './PDFHighlight'
export { PDFSidebar } from './PDFSidebar'

// Context Provider
export { PDFProvider, usePDFContext } from './PDFContext'

// Worker configuration utilities
export { 
  configurePDFWorker, 
  getWorkerSrc, 
  WorkerSources,
  resetWorkerConfiguration,
  isWorkerConfiguredProperly,
  retryWorkerConfiguration,
  getWorkerRetryCount
} from './worker'

// PDF Loader
export { PDFLoader } from './PDFLoader'

// Hooks
export { useKeyboardShortcuts } from './useKeyboardShortcuts'
export type { KeyboardShortcutsHandlers } from './useKeyboardShortcuts'

// Types
export type {
  PDFViewerProps,
  PDFToolbarProps,
  PDFPageProps,
  PDFHighlightProps,
  PDFSidebarProps,
  PDFDocumentProxy,
  PDFPageProxy,
  PDFPageViewport,
  PDFRenderContext,
  PDFRenderTask,
  PDFTextContent,
  PDFTextItem,
  PDFHighlight as PDFHighlightType,
  PDFRect,
  PDFWorkerOptions,
  PDFLoadingTask,
  PDFOutlineItem,
  PDFAttachment,
  PDFDocumentInfo,
  ToolbarTool,
  ViewMode,
  SidebarView,
  ZoomMode,
} from './types'

// Re-export PDF.js types for convenience
export type * from 'pdfjs-dist'

// Default export
export { PDFViewer as default } from './PDFViewer' 