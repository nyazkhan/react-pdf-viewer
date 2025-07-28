import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { 
  PDFViewerProps, 
  PDFDocumentProxy, 
  PDFLoadingTask,
  ToolbarTool,
  ViewMode,
  SidebarView,
  ZoomMode,
  PDFOutlineItem,
  PDFAttachment,
  PDFDocumentInfo
} from './types'
import { PDFToolbar } from './PDFToolbar'
import { PDFSidebar } from './PDFSidebar'
import { PDFPage } from './PDFPage'
import { PDFLoader } from './PDFLoader'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import './worker' // Auto-configure worker on import

const PDFViewerComponent: React.FC<PDFViewerProps> = ({
  file,
  page = 1,
  scale = 1.0,
  rotation = 0,
  viewMode = 'single',
  sidebarView = 'none',
  zoomMode = 'auto',
  activeTool = 'none',
  enableKeyboardShortcuts = true,
  onDocumentLoad,
  onPageChange,
  onScaleChange,
  onRotationChange,
  onViewModeChange,
  onSidebarToggle,
  onSidebarViewChange,
  onToolChange,
  onError,
  onSearch,
  onPrint,
  onDownload,
  onOpenFile,
  onPresentationMode,
  onDocumentInfo,
  className = '',
  style,
  enableTextSelection = true,
  highlights = [],
  renderToolbar = true,
  renderSidebar = true,
  customToolbar,
  width = '100%',
  height = '600px',
  enableAnnotations = true,
  enableForms = true,
  enableSearch = true,
  enableThumbnails = true,
  showPageControls = true,
  showZoomControls = true,
  showRotateControls = true,
  showViewModeControls = true,
  showOpenOption = true,
  showSearchOption = true,
  showPrintOption = true,
  showDownloadOption = true,
  showToolSelection = true,
  showFitOptions = true,
  showPresentationMode = true,
}) => {
  // Core PDF state
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(page)
  const [currentScale, setCurrentScale] = useState(scale)
  const [currentRotation, setCurrentRotation] = useState(rotation)
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(viewMode)
  const [currentZoomMode, setCurrentZoomMode] = useState<ZoomMode>(zoomMode)
  const [currentTool, setCurrentTool] = useState<ToolbarTool>(activeTool)
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(sidebarView !== 'none')
  const [currentSidebarView, setCurrentSidebarView] = useState<SidebarView>(sidebarView)
  const [outline, setOutline] = useState<PDFOutlineItem[]>([])
  const [attachments, setAttachments] = useState<PDFAttachment[]>([])
  const [documentInfo, setDocumentInfo] = useState<PDFDocumentInfo | null>(null)
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(0)
  const [currentSearchResult, setCurrentSearchResult] = useState(0)
  
  // Presentation mode state
  const [presentationMode, setPresentationMode] = useState(false)
  
  const loadingTaskRef = useRef<PDFLoadingTask | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentFileRef = useRef<string | File | ArrayBuffer | Uint8Array | null>(null)
  const loadingAbortControllerRef = useRef<AbortController | null>(null)

  // Clean up function
  const cleanup = useCallback(() => {
    // Cancel any ongoing loading
    if (loadingAbortControllerRef.current) {
      loadingAbortControllerRef.current.abort()
      loadingAbortControllerRef.current = null
    }
    
    if (loadingTaskRef.current) {
      try {
        loadingTaskRef.current.destroy()
      } catch (error) {
        console.warn('Error destroying loading task:', error)
      }
      loadingTaskRef.current = null
    }
    if (pdf) {
      try {
        pdf.destroy()
      } catch (error) {
        console.warn('Error destroying PDF document:', error)
      }
    }
  }, [pdf])

  // Stable file key reference
  const fileKeyRef = useRef<string>('')
  const lastSuccessfulFileRef = useRef<string>('')

  // Generate stable file key
  const getFileKey = useCallback((file: string | File | ArrayBuffer | Uint8Array) => {
    if (typeof file === 'string') return file
    if (file instanceof File) return `${file.name}-${file.size}-${file.lastModified}`
    return `buffer-${file.byteLength}`
  }, [])

  // Load document metadata
  const loadDocumentMetadata = useCallback(async (pdfDoc: PDFDocumentProxy) => {
    try {
      // Load document info
      const info = await pdfDoc.getMetadata()
      setDocumentInfo(info.info as PDFDocumentInfo)
      
      // Load outline
      try {
        const outlineData = await pdfDoc.getOutline()
        if (outlineData) {
          // Convert PDF.js outline format to our format
          const convertOutline = (items: any[]): PDFOutlineItem[] => {
            return items.map(item => ({
              title: item.title || '',
              bold: item.bold || false,
              italic: item.italic || false,
              color: item.color ? [item.color[0], item.color[1], item.color[2]] as [number, number, number] : undefined,
              dest: item.dest,
              url: item.url,
              items: item.items ? convertOutline(item.items) : undefined
            }))
          }
          setOutline(convertOutline(outlineData))
        }
      } catch (error) {
        console.warn('No document outline available:', error)
        setOutline([])
      }
      
      // Load attachments
      try {
        const attachmentData = await pdfDoc.getAttachments()
        if (attachmentData) {
          const attachmentList: PDFAttachment[] = []
          for (const [filename, data] of Object.entries(attachmentData) as [string, any][]) {
            attachmentList.push({
              filename,
              content: data.content
            })
          }
          setAttachments(attachmentList)
        }
      } catch (error) {
        console.warn('No attachments available:', error)
        setAttachments([])
      }
    } catch (error) {
      console.warn('Error loading document metadata:', error)
    }
  }, [])

  // Load PDF function with comprehensive error handling
  const loadPDF = useCallback(async () => {
    const fileKey = getFileKey(file)
    
    // Skip if same file is already loaded successfully
    if (fileKey === lastSuccessfulFileRef.current && pdf) {
      console.debug('PDF already loaded for this file, skipping reload')
      return
    }
    
    // Skip if already loading the same file
    if (fileKey === fileKeyRef.current && loading) {
      console.debug('PDF load already in progress for this file, skipping duplicate request')
      return
    }
    
    fileKeyRef.current = fileKey
    
    // Cancel previous loading if it's for a different file
    if (loadingAbortControllerRef.current && fileKey !== fileKeyRef.current) {
      loadingAbortControllerRef.current.abort()
    }
    
    // Create new abort controller for this request
    loadingAbortControllerRef.current = new AbortController()
    
    setLoading(true)
    setError(null)
    
    try {
      cleanup()
      
      const result = await PDFLoader.loadPDF({ file })
      
      // Check if request was aborted
      if (loadingAbortControllerRef.current?.signal.aborted) {
        console.debug('PDF load was cancelled')
        return
      }
      
      if (result.error) {
        throw result.error
      }
      
      if (!result.pdf) {
        throw new Error('Failed to load PDF')
      }
      
      setPdf(result.pdf)
      setNumPages(result.pdf.numPages)
      lastSuccessfulFileRef.current = fileKey
      
      // Load document metadata
      await loadDocumentMetadata(result.pdf)
      
      if (onDocumentLoad) {
        onDocumentLoad(result.pdf)
      }
      
      console.debug(`PDF loaded successfully: ${result.pdf.numPages} pages`)
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.debug('PDF load was cancelled')
        return
      }
      
      const errorMessage = error.message || 'Failed to load PDF'
      console.error('PDF load error:', error)
      setError(errorMessage)
      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
      loadingAbortControllerRef.current = null
    }
  }, [file, getFileKey, loading, pdf, cleanup, loadDocumentMetadata, onDocumentLoad, onError])

  // Load PDF with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPDF()
    }, 300) // 300ms debounce
    
    return () => clearTimeout(timeoutId)
  }, [loadPDF])

  // Sync props with internal state
  useEffect(() => {
    if (page !== currentPage) {
      setCurrentPage(page)
    }
  }, [page, currentPage])

  useEffect(() => {
    if (scale !== currentScale) {
      setCurrentScale(scale)
    }
  }, [scale, currentScale])

  useEffect(() => {
    if (rotation !== currentRotation) {
      setCurrentRotation(rotation)
    }
  }, [rotation, currentRotation])

  useEffect(() => {
    if (viewMode !== currentViewMode) {
      setCurrentViewMode(viewMode)
    }
  }, [viewMode, currentViewMode])

  useEffect(() => {
    if (activeTool !== currentTool) {
      setCurrentTool(activeTool)
    }
  }, [activeTool, currentTool])

  useEffect(() => {
    if (sidebarView !== currentSidebarView) {
      setCurrentSidebarView(sidebarView)
      setSidebarOpen(sidebarView !== 'none')
    }
  }, [sidebarView, currentSidebarView])

  // Navigation handlers
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= numPages && newPage !== currentPage) {
      setCurrentPage(newPage)
      if (onPageChange) {
        onPageChange(newPage)
      }
    }
  }, [currentPage, numPages, onPageChange])

  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      handlePageChange(currentPage + 1)
    }
  }, [currentPage, numPages, handlePageChange])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }, [currentPage, handlePageChange])

  const goToFirstPage = useCallback(() => {
    handlePageChange(1)
  }, [handlePageChange])

  const goToLastPage = useCallback(() => {
    handlePageChange(numPages)
  }, [numPages, handlePageChange])

  // Zoom handlers
  const handleScaleChange = useCallback((newScale: number) => {
    if (Math.abs(newScale - currentScale) > 0.01) {
      setCurrentScale(newScale)
      setCurrentZoomMode('auto') // Reset zoom mode when manually changing scale
      if (onScaleChange) {
        onScaleChange(newScale)
      }
    }
  }, [currentScale, onScaleChange])

  const zoomIn = useCallback(() => {
    const newScale = Math.min(currentScale * 1.25, 5.0)
    handleScaleChange(newScale)
  }, [currentScale, handleScaleChange])

  const zoomOut = useCallback(() => {
    const newScale = Math.max(currentScale / 1.25, 0.25)
    handleScaleChange(newScale)
  }, [currentScale, handleScaleChange])

  const handleZoomToFit = useCallback(() => {
    setCurrentZoomMode('page-fit')
    // Calculate fit-to-page scale based on container size
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight - 100 // Account for toolbar
      const containerWidth = containerRef.current.clientWidth - (sidebarOpen ? 250 : 0)
      const scale = Math.min(containerWidth / 612, containerHeight / 792) // Standard page size
      handleScaleChange(scale)
    }
  }, [handleScaleChange, sidebarOpen])

  const handleZoomToWidth = useCallback(() => {
    setCurrentZoomMode('page-width')
    // Calculate fit-to-width scale
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - (sidebarOpen ? 250 : 0) - 40 // Account for padding
      const scale = containerWidth / 612 // Standard page width
      handleScaleChange(scale)
    }
  }, [handleScaleChange, sidebarOpen])

  const handleActualSize = useCallback(() => {
    setCurrentZoomMode('actual')
    handleScaleChange(1.0)
  }, [handleScaleChange])

  // Zoom mode handlers
  const handleZoomModeChange = useCallback((mode: ZoomMode) => {
    setCurrentZoomMode(mode)
    switch (mode) {
      case 'page-fit':
        handleZoomToFit()
        break
      case 'page-width':
        handleZoomToWidth()
        break
      case 'actual':
        handleActualSize()
        break
    }
  }, [handleZoomToFit, handleZoomToWidth, handleActualSize])

  // Rotation handler
  const handleRotate = useCallback(() => {
    const newRotation = (currentRotation + 90) % 360
    setCurrentRotation(newRotation)
    if (onRotationChange) {
      onRotationChange(newRotation)
    }
  }, [currentRotation, onRotationChange])

  const handleRotateCounterClockwise = useCallback(() => {
    const newRotation = (currentRotation - 90 + 360) % 360
    setCurrentRotation(newRotation)
    if (onRotationChange) {
      onRotationChange(newRotation)
    }
  }, [currentRotation, onRotationChange])

  // View mode handlers
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setCurrentViewMode(mode)
    if (onViewModeChange) {
      onViewModeChange(mode)
    }
  }, [onViewModeChange])

  // Sidebar handlers
  const handleSidebarToggle = useCallback(() => {
    const newOpen = !sidebarOpen
    setSidebarOpen(newOpen)
    if (!newOpen) {
      setCurrentSidebarView('none')
    } else if (currentSidebarView === 'none') {
      setCurrentSidebarView('thumbnails')
    }
    if (onSidebarToggle) {
      onSidebarToggle(newOpen)
    }
  }, [sidebarOpen, currentSidebarView, onSidebarToggle])

  const handleSidebarViewChange = useCallback((view: SidebarView) => {
    setCurrentSidebarView(view)
    setSidebarOpen(view !== 'none')
    if (onSidebarViewChange) {
      onSidebarViewChange(view)
    }
  }, [onSidebarViewChange])

  // Tool handlers
  const handleToolChange = useCallback((tool: ToolbarTool) => {
    setCurrentTool(tool)
    if (onToolChange) {
      onToolChange(tool)
    }
  }, [onToolChange])

  // Search handlers
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    // TODO: Implement actual search functionality
    setSearchResults(0)
    setCurrentSearchResult(0)
    if (onSearch) {
      onSearch(term)
    }
  }, [onSearch])

  const handleSearchNext = useCallback(() => {
    if (searchResults > 0) {
      setCurrentSearchResult((prev) => (prev % searchResults) + 1)
    }
  }, [searchResults])

  const handleSearchPrevious = useCallback(() => {
    if (searchResults > 0) {
      setCurrentSearchResult((prev) => (prev === 1 ? searchResults : prev - 1))
    }
  }, [searchResults])

  const handleClearSearch = useCallback(() => {
    setSearchTerm('')
    setSearchResults(0)
    setCurrentSearchResult(0)
  }, [])

  // File handlers
  const handleOpenFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file && onOpenFile) {
        onOpenFile(file)
      }
    }
    input.click()
  }, [onOpenFile])

  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint()
    } else {
      // Default print implementation
      window.print()
    }
  }, [onPrint])

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload()
    } else if (typeof file === 'string') {
      // Download from URL
      const link = document.createElement('a')
      link.href = file
      link.download = 'document.pdf'
      link.click()
    } else if (file instanceof File) {
      // Download File object
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
    }
  }, [file, onDownload])

  // Presentation mode handlers
  const handlePresentationMode = useCallback(() => {
    setPresentationMode(!presentationMode)
    if (onPresentationMode) {
      onPresentationMode()
    }
    
    // Request fullscreen
    if (!presentationMode && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }, [presentationMode, onPresentationMode])

  // Document info handler
  const handleDocumentInfo = useCallback(() => {
    if (documentInfo && onDocumentInfo) {
      onDocumentInfo(documentInfo)
    } else if (documentInfo) {
      // Show default document info dialog
      const info = Object.entries(documentInfo as Record<string, any>)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
      alert(`Document Information:\n\n${info}`)
    }
  }, [documentInfo, onDocumentInfo])

  // Outline click handler
  const handleOutlineClick = useCallback((dest: any) => {
    // TODO: Navigate to destination
    console.log('Navigate to destination:', dest)
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts(enableKeyboardShortcuts && !presentationMode, {
    onNextPage: goToNextPage,
    onPreviousPage: goToPrevPage,
    onFirstPage: goToFirstPage,
    onLastPage: goToLastPage,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onActualSize: handleActualSize,
    onRotateClockwise: handleRotate,
    onRotateCounterClockwise: handleRotateCounterClockwise,
    onPresentationMode: handlePresentationMode,
    onHandTool: () => handleToolChange('pan'),
    onTextSelection: () => handleToolChange('selection'),
    onFind: () => handleSearch(''),
    onFindNext: handleSearchNext,
    onFindPrevious: handleSearchPrevious,
    onDownload: handleDownload,
    onPrint: handlePrint,
    onOpenFile: handleOpenFile,
    onGoToPage: () => {
      const page = prompt('Go to page:')
      if (page) {
        const pageNum = parseInt(page, 10)
        if (!isNaN(pageNum)) {
          handlePageChange(pageNum)
        }
      }
    },
    onToggleSidebar: handleSidebarToggle,
  })

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  const containerStyle: React.CSSProperties = {
    width,
    height,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
    position: presentationMode ? 'fixed' : 'relative',
    top: presentationMode ? 0 : 'auto',
    left: presentationMode ? 0 : 'auto',
    right: presentationMode ? 0 : 'auto',
    bottom: presentationMode ? 0 : 'auto',
    zIndex: presentationMode ? 9999 : 'auto',
    ...style,
  }

  const mainContentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  }

  const viewerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: currentViewMode === 'continuous' ? 'flex-start' : 'center',
    padding: '20px',
    backgroundColor: '#525659',
  }

  if (loading) {
    return (
      <div className={`pdf-viewer ${className}`} style={containerStyle} ref={containerRef}>
        <div style={viewerStyle}>
          <div style={{ color: 'white', fontSize: '16px' }}>Loading PDF...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`pdf-viewer ${className}`} style={containerStyle} ref={containerRef}>
        <div style={viewerStyle}>
          <div style={{ color: '#ff6b6b', fontSize: '16px' }}>Error: {error}</div>
        </div>
      </div>
    )
  }

  if (!pdf) {
    return (
      <div className={`pdf-viewer ${className}`} style={containerStyle} ref={containerRef}>
        <div style={viewerStyle}>
          <div style={{ color: 'white', fontSize: '16px' }}>No PDF loaded</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`pdf-viewer ${className}`} style={containerStyle} ref={containerRef}>
      {renderToolbar && !customToolbar && !presentationMode && (
        <PDFToolbar
          currentPage={currentPage}
          totalPages={numPages}
          scale={currentScale}
          viewMode={currentViewMode}
          zoomMode={currentZoomMode}
          activeTool={currentTool}
          searchTerm={searchTerm}
          searchResults={searchResults}
          currentSearchResult={currentSearchResult}
          sidebarOpen={sidebarOpen}
          onPageChange={handlePageChange}
          onScaleChange={handleScaleChange}
          onPrevPage={goToPrevPage}
          onNextPage={goToNextPage}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onRotate={handleRotate}
          onOpenFile={handleOpenFile}
          onPrint={handlePrint}
          onDownload={handleDownload}
          onSearch={handleSearch}
          onSearchNext={handleSearchNext}
          onSearchPrevious={handleSearchPrevious}
          onClearSearch={handleClearSearch}
          onToolChange={handleToolChange}
          onZoomToFit={handleZoomToFit}
          onZoomToWidth={handleZoomToWidth}
          onViewModeChange={handleViewModeChange}
          onZoomModeChange={handleZoomModeChange}
          onSidebarToggle={handleSidebarToggle}
          onPresentationMode={handlePresentationMode}
          onDocumentInfo={handleDocumentInfo}
          showPageControls={showPageControls}
          showZoomControls={showZoomControls}
          showRotateControls={showRotateControls}
          showViewModeControls={showViewModeControls}
          showOpenOption={showOpenOption}
          showSearchOption={showSearchOption}
          showPrintOption={showPrintOption}
          showDownloadOption={showDownloadOption}
          showToolSelection={showToolSelection}
          showFitOptions={showFitOptions}
          showPresentationMode={showPresentationMode}
        />
      )}
      {customToolbar}
      
      <div style={mainContentStyle}>
        {renderSidebar && sidebarOpen && !presentationMode && (
          <PDFSidebar
            isOpen={sidebarOpen}
            activeView={currentSidebarView}
            pdf={pdf}
            currentPage={currentPage}
            outline={outline}
            attachments={attachments}
            onToggle={handleSidebarToggle}
            onViewChange={handleSidebarViewChange}
            onPageSelect={handlePageChange}
            onOutlineClick={handleOutlineClick}
          />
        )}
        
        <div style={viewerStyle}>
          {currentViewMode === 'continuous' ? (
            // Continuous view - render multiple pages
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                <PDFPage
                  key={pageNum}
                  pageNumber={pageNum}
                  scale={currentScale}
                  rotation={currentRotation}
                  pdf={pdf}
                  enableTextSelection={enableTextSelection}
                  highlights={highlights}
                />
              ))}
            </div>
          ) : currentViewMode === 'two-page' ? (
            // Two-page view
            <div style={{ display: 'flex', gap: '20px' }}>
              <PDFPage
                pageNumber={currentPage}
                scale={currentScale}
                rotation={currentRotation}
                pdf={pdf}
                enableTextSelection={enableTextSelection}
                highlights={highlights}
              />
              {currentPage < numPages && (
                <PDFPage
                  pageNumber={currentPage + 1}
                  scale={currentScale}
                  rotation={currentRotation}
                  pdf={pdf}
                  enableTextSelection={enableTextSelection}
                  highlights={highlights}
                />
              )}
            </div>
          ) : (
            // Single page view
            <PDFPage
              pageNumber={currentPage}
              scale={currentScale}
              rotation={currentRotation}
              pdf={pdf}
              enableTextSelection={enableTextSelection}
              highlights={highlights}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Memoize the component for performance
const propsComparison = (prevProps: PDFViewerProps, nextProps: PDFViewerProps) => {
  // File comparison
  if (prevProps.file !== nextProps.file) {
    if (typeof prevProps.file === 'string' && typeof nextProps.file === 'string') {
      return prevProps.file === nextProps.file
    }
    if (prevProps.file instanceof File && nextProps.file instanceof File) {
      return (
        prevProps.file.name === nextProps.file.name &&
        prevProps.file.size === nextProps.file.size &&
        prevProps.file.lastModified === nextProps.file.lastModified
      )
    }
    return false
  }

  // Other props comparison
  return (
    prevProps.page === nextProps.page &&
    prevProps.scale === nextProps.scale &&
    prevProps.rotation === nextProps.rotation &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.sidebarView === nextProps.sidebarView &&
    prevProps.zoomMode === nextProps.zoomMode &&
    prevProps.activeTool === nextProps.activeTool &&
    prevProps.enableTextSelection === nextProps.enableTextSelection &&
    prevProps.enableKeyboardShortcuts === nextProps.enableKeyboardShortcuts &&
    prevProps.renderToolbar === nextProps.renderToolbar &&
    prevProps.renderSidebar === nextProps.renderSidebar
  )
}

export const PDFViewer = React.memo(PDFViewerComponent, propsComparison)

export default PDFViewer 