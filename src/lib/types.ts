import { CSSProperties, ReactNode } from 'react'
import type {
  PDFDocumentProxy as PDFJSDocumentProxy,
  PDFPageProxy as PDFJSPageProxy,
  PageViewport as PDFJSPageViewport,
  RenderTask as PDFJSRenderTask,
  PDFDocumentLoadingTask as PDFJSLoadingTask,
} from 'pdfjs-dist'

// Re-export PDF.js types with our names
export type PDFDocumentProxy = PDFJSDocumentProxy
export type PDFPageProxy = PDFJSPageProxy
export type PDFPageViewport = PDFJSPageViewport
export type PDFRenderTask = PDFJSRenderTask
export type PDFLoadingTask = PDFJSLoadingTask

// Custom types for text content and render context
export interface PDFTextContent {
  items: PDFTextItem[]
}

export interface PDFTextItem {
  str: string
  dir: string
  width: number
  height: number
  transform: number[]
  fontName: string
}

export interface PDFRenderContext {
  canvasContext: CanvasRenderingContext2D
  viewport: PDFPageViewport
  background?: string
}

export type ToolbarTool = 
  | 'none'
  | 'pan'
  | 'selection' 
  | 'annotation'

export type ViewMode = 'single' | 'continuous' | 'two-page' | 'book'
export type SidebarView = 'none' | 'thumbnails' | 'outline' | 'attachments' | 'layers'
export type ZoomMode = 'auto' | 'page-fit' | 'page-width' | 'page-height' | 'actual'

export interface PDFOutlineItem {
  title: string
  bold?: boolean
  italic?: boolean
  color?: [number, number, number]
  dest?: any
  url?: string
  items?: PDFOutlineItem[]
}

export interface PDFAttachment {
  filename: string
  content: Uint8Array
}

export interface PDFDocumentInfo {
  Title?: string
  Author?: string
  Subject?: string
  Creator?: string
  Producer?: string
  CreationDate?: string
  ModDate?: string
  Keywords?: string
  PDFFormatVersion?: string
}

export interface PDFSidebarProps {
  isOpen: boolean
  activeView: SidebarView
  pdf?: PDFDocumentProxy
  currentPage: number
  outline?: PDFOutlineItem[]
  attachments?: PDFAttachment[]
  onToggle: () => void
  onViewChange: (view: SidebarView) => void
  onPageSelect: (page: number) => void
  onOutlineClick: (dest: any) => void
  className?: string
  style?: CSSProperties
}

export interface PDFViewerProps {
  file: string | File | ArrayBuffer | Uint8Array
  page?: number
  scale?: number
  rotation?: number
  viewMode?: ViewMode
  sidebarView?: SidebarView
  zoomMode?: ZoomMode
  activeTool?: ToolbarTool
  onDocumentLoad?: (pdf: PDFDocumentProxy) => void
  onPageChange?: (page: number) => void
  onScaleChange?: (scale: number) => void
  onRotationChange?: (rotation: number) => void
  onViewModeChange?: (mode: ViewMode) => void
  onSidebarToggle?: (isOpen: boolean) => void
  onSidebarViewChange?: (view: SidebarView) => void
  onToolChange?: (tool: ToolbarTool) => void
  onError?: (error: Error) => void
  onSearch?: (term: string) => void
  onPrint?: () => void
  onDownload?: () => void
  onOpenFile?: (file: File) => void
  onPresentationMode?: () => void
  onDocumentInfo?: (info: PDFDocumentInfo) => void
  
  // Keyboard shortcuts
  enableKeyboardShortcuts?: boolean
  
  // Layout and styling
  className?: string
  style?: CSSProperties
  enableTextSelection?: boolean
  highlights?: PDFHighlight[]
  renderToolbar?: boolean
  renderSidebar?: boolean
  customToolbar?: ReactNode
  width?: number | string
  height?: number | string
  
  // Advanced features
  enableAnnotations?: boolean
  enableForms?: boolean
  enableSearch?: boolean
  enableThumbnails?: boolean
  
  // Toolbar customization
  showPageControls?: boolean
  showZoomControls?: boolean
  showRotateControls?: boolean
  showViewModeControls?: boolean
  showOpenOption?: boolean
  showSearchOption?: boolean
  showPrintOption?: boolean
  showDownloadOption?: boolean
  showToolSelection?: boolean
  showFitOptions?: boolean
  showPresentationMode?: boolean
}

export interface PDFToolbarProps {
  currentPage: number
  totalPages: number
  scale: number
  viewMode?: ViewMode
  zoomMode?: ZoomMode
  activeTool?: ToolbarTool
  searchTerm?: string
  searchResults?: number
  currentSearchResult?: number
  sidebarOpen?: boolean
  onPageChange: (page: number) => void
  onScaleChange: (scale: number) => void
  onPrevPage: () => void
  onNextPage: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onRotate?: () => void
  
  // Advanced toolbar options
  onOpenFile?: () => void
  onPrint?: () => void
  onDownload?: () => void
  onSearch?: (term: string) => void
  onSearchNext?: () => void
  onSearchPrevious?: () => void
  onClearSearch?: () => void
  onToolChange?: (tool: ToolbarTool) => void
  onZoomToFit?: () => void
  onZoomToWidth?: () => void
  onViewModeChange?: (mode: ViewMode) => void
  onZoomModeChange?: (mode: ZoomMode) => void
  onSidebarToggle?: () => void
  onPresentationMode?: () => void
  onDocumentInfo?: () => void
  
  className?: string
  style?: CSSProperties
  showPageControls?: boolean
  showZoomControls?: boolean
  showRotateControls?: boolean
  showViewModeControls?: boolean
  showOpenOption?: boolean
  showSearchOption?: boolean
  showPrintOption?: boolean
  showDownloadOption?: boolean
  showToolSelection?: boolean
  showFitOptions?: boolean
  showPresentationMode?: boolean
}

export interface PDFPageProps {
  pageNumber: number
  scale?: number
  rotation?: number
  pdf: PDFDocumentProxy
  onPageRender?: (page: PDFPageProxy) => void
  onError?: (error: Error) => void
  className?: string
  style?: CSSProperties
  enableTextSelection?: boolean
  highlights?: PDFHighlight[]
}

export interface PDFHighlight {
  id: string
  pageNumber: number
  rects: PDFRect[]
  color?: string
  opacity?: number
  content?: string
  onClick?: (highlight: PDFHighlight) => void
}

export interface PDFRect {
  left: number
  top: number
  width: number
  height: number
}

export interface PDFHighlightProps {
  highlights: PDFHighlight[]
  pageNumber: number
  viewport: PDFPageViewport
  onHighlightClick?: (highlight: PDFHighlight) => void
  className?: string
  style?: CSSProperties
}

export interface PDFWorkerOptions {
  workerSrc?: string
} 