import React, { useState, useCallback } from 'react'
import {
  PDFViewer,
  PDFUtils,
  type ViewMode,
  type SidebarView,
  type ZoomMode,
  type ToolbarTool,
  type PDFDocumentProxy,
  type PDFDocumentInfo,
  type PDFHighlightType,
  type PDFPageViewport
} from '../../dist/index.mjs'
import '../../dist/styles/viewer.css'
import TestPDFExample from './TestPDFExample'
import { useHighlightAPI, getViewportInfo } from './highlightAPI'
import config from './config'

type AppMode = 'comprehensive' | 'simple'

function App() {
  // App mode state
  const [appMode, setAppMode] = useState<AppMode>('comprehensive')
  
  // PDF file state
  const [file, setFile] = useState<string | File>(PDFUtils.samples.urls.local_tracemonkey)
  
  // PDF viewer state
  const [currentPage, setCurrentPage] = useState(1)
  const [currentScale, setCurrentScale] = useState(1.0)
  const [currentRotation, setCurrentRotation] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [sidebarView, setSidebarView] = useState<SidebarView>('thumbnails')
  const [zoomMode] = useState<ZoomMode>('auto')
  const [activeTool, setActiveTool] = useState<ToolbarTool>('selection')
  const [documentInfo, setDocumentInfo] = useState<PDFDocumentInfo | null>(null)
  
  // Highlights state
  const [highlights, setHighlights] = useState<PDFHighlightType[]>([])
  const [highlightText, setHighlightText] = useState('')
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [currentViewport, setCurrentViewport] = useState<PDFPageViewport | null>(null)
  const [highlightRenderKey, setHighlightRenderKey] = useState(0) // Force re-render key
  
  // API integration
  const { searchAndHighlight, searchLocalPDF, healthCheck, isLoading, error } = useHighlightAPI()
  
  // API health state
  const [apiAvailable, setApiAvailable] = useState(false)
  
  // Worker status
  const [workerInfo, setWorkerInfo] = useState({
    configured: false,
    workerSrc: '',
    retryCount: 0,
    testResult: ''
  })

  // Create highlight from text search using PyMuPDF API
  const createHighlightFromText = useCallback(async (searchText: string) => {
    if (!pdfDocument || !searchText.trim()) {
      console.log('❌ No PDF document or search text provided')
      return
    }

    if (!currentViewport) {
      console.warn('❌ No viewport available for highlighting')
      return
    }

    console.log('🔍 Starting highlight creation:', {
      searchText: searchText.substring(0, 50) + '...',
      currentPage: currentPage,
      currentScale: currentScale,
      viewport: { width: currentViewport.width, height: currentViewport.height, scale: currentViewport.scale },
      apiAvailable: apiAvailable,
      fileType: file instanceof File ? 'File' : typeof file
    })

    try {
      let newHighlights: PDFHighlightType[] = []

      if (config.enabled && apiAvailable) {
        // Use PyMuPDF API for superior highlighting
        if (file instanceof File) {
          // File upload case - always search current page only
          const viewport = getViewportInfo(currentViewport)
          const searchOptions = { pageNumber: currentPage }
          console.log('📄 Using file upload API call with viewport:', { viewport, searchOptions })
          newHighlights = await searchAndHighlight(file, searchText, viewport, searchOptions)
        } else if (typeof file === 'string' && file.startsWith('/')) {
          // Local file case (for development) - always search current page only
          const viewport = getViewportInfo(currentViewport)
          const searchOptions = { pageNumber: currentPage }
          // For local files, try to resolve path relative to public directory
          const absolutePath = file.startsWith('/public/') 
            ? `/Users/rahil/workspace/react-pdf-viewer/example${file}`
            : `/Users/rahil/workspace/react-pdf-viewer/example/public${file}`
          console.log('📄 Using local file API call:', { absolutePath, viewport, searchOptions })
          newHighlights = await searchLocalPDF(absolutePath, searchText, viewport, searchOptions)
        } else {
          // URL case - fallback to built-in for now (could implement URL download + API call)
          if (config.fallbackToBuiltIn) {
            console.log('🌐 Using built-in highlighting for URL-based PDF')
            newHighlights = await PDFUtils.createHighlights(pdfDocument, searchText)
          }
        }
      } else {
        // API disabled or unavailable, use built-in highlighting
        console.log('🔧 Using built-in highlighting (API disabled or unavailable)')
        newHighlights = await PDFUtils.createHighlights(pdfDocument, searchText)
      }

      console.log('✅ Highlights created successfully:', {
        count: newHighlights.length,
        highlights: newHighlights.map(h => ({
          id: h.id,
          pageNumber: h.pageNumber,
          rectsCount: h.rects.length,
          content: h.content?.substring(0, 30) + '...'
        }))
      })

      // Update highlights and force immediate re-render
      setHighlights(newHighlights)
      setHighlightRenderKey(prev => prev + 1) // Force component re-render
      
      if (config.debug) {
        const method = config.enabled && apiAvailable ? 'PyMuPDF API' : 'built-in'
        console.log(`Created ${newHighlights.length} highlights using ${method}`)
      }
    } catch (error) {
      console.error('❌ Error creating highlights:', error)
      
      // Fallback to built-in highlighting on API error
      if (config.enabled && config.fallbackToBuiltIn) {
        try {
          console.log('🔄 Falling back to built-in highlighting due to API error')
          const fallbackHighlights = await PDFUtils.createHighlights(pdfDocument, searchText)
          setHighlights(fallbackHighlights)
        } catch (fallbackError) {
          console.error('❌ Fallback highlighting also failed:', fallbackError)
        }
      }
    }
  }, [pdfDocument, currentViewport, file, searchAndHighlight, searchLocalPDF, apiAvailable, currentPage, currentScale])

  // Handle highlight text change
  const handleHighlightTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHighlightText(event.target.value)
  }, [])

  // Handle highlight text submission
  const handleHighlightText = useCallback(() => {
    createHighlightFromText(highlightText)
  }, [highlightText, createHighlightFromText])

  // Clear all highlights
  const clearHighlights = useCallback(() => {
    setHighlights([])
    setHighlightText('')
  }, [])

  // Predefined text highlight using library samples
  const highlightPredefinedText = useCallback(() => {
    const predefinedText = PDFUtils.samples.texts.traceMonkey
    setHighlightText(predefinedText)
    createHighlightFromText(predefinedText)
  }, [createHighlightFromText])

  // Check API health on component mount
  const checkAPIHealth = useCallback(async () => {
    if (config.enabled) {
      try {
        const isHealthy = await healthCheck()
        setApiAvailable(isHealthy)
        if (config.debug) {
          console.log(`API health check: ${isHealthy ? '✅ Available' : '❌ Unavailable'}`)
        }
      } catch (error) {
        console.warn('API health check failed:', error)
        setApiAvailable(false)
      }
    }
  }, [healthCheck])

  // Update worker info using library utility
  const updateWorkerInfo = useCallback(() => {
    const info = PDFUtils.getWorkerInfo()
    setWorkerInfo({
      configured: info.configured,
      workerSrc: info.workerSrc,
      retryCount: info.retryCount,
      testResult: ''
    })
    // Also check API health when worker info is updated
    checkAPIHealth()
  }, [checkAPIHealth])

  // Test worker functionality using library utility
  const testWorker = useCallback(async () => {
    const result = await PDFUtils.testWorker()
    setWorkerInfo(prev => ({ ...prev, testResult: result.message }))
    updateWorkerInfo()
  }, [updateWorkerInfo])

  // Reset worker using library utility
  const resetWorker = useCallback(() => {
    PDFUtils.resetWorker()
    updateWorkerInfo()
  }, [updateWorkerInfo])

  // File selection handler
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }, [])

  // URL input handler
  const handleUrlChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.value)
  }, [])

  // PDF event handlers
  const handleDocumentLoad = useCallback(async (pdf: PDFDocumentProxy) => {
    console.log('PDF loaded:', pdf.numPages, 'pages')
    updateWorkerInfo()
    setPdfDocument(pdf)
    
    // Get initial viewport for current page and scale
    try {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale: currentScale, rotation: currentRotation })
      setCurrentViewport(viewport)
      if (config.debug) {
        console.log('🚀 Initial viewport set:', { 
          width: viewport.width, 
          height: viewport.height, 
          scale: viewport.scale, 
          rotation: viewport.rotation,
          page: currentPage
        })
      }
    } catch (error) {
      console.warn('❌ Failed to get initial viewport:', error)
    }
  }, [updateWorkerInfo, currentPage, currentScale, currentRotation])

  const handleError = useCallback((error: Error) => {
    console.error('PDF error:', error)
    updateWorkerInfo()
  }, [updateWorkerInfo])

  // Handle page change
  const handlePageChange = useCallback(async (page: number) => {
    setCurrentPage(page)
    
    // Update viewport for new page
    if (pdfDocument) {
      try {
        const pdfPage = await pdfDocument.getPage(page)
        const viewport = pdfPage.getViewport({ scale: currentScale, rotation: currentRotation })
        setCurrentViewport(viewport)
        // Force highlight re-render on page change to ensure proper viewport sync
        setHighlightRenderKey(prev => prev + 1)
        if (config.debug) {
          console.log('📄 Viewport updated for page change:', { 
            page, 
            width: viewport.width, 
            height: viewport.height,
            scale: viewport.scale,
            rotation: viewport.rotation
          })
        }
      } catch (error) {
        console.warn('❌ Failed to update viewport for new page:', error)
      }
    }
  }, [pdfDocument, currentScale, currentRotation])

  const handleScaleChange = useCallback(async (scale: number) => {
    setCurrentScale(scale)
    
    // Update viewport for new scale
    if (pdfDocument) {
      try {
        const page = await pdfDocument.getPage(currentPage)
        const viewport = page.getViewport({ scale: scale, rotation: currentRotation })
        setCurrentViewport(viewport)
        // Force highlight re-render on scale change to ensure proper coordinate sync
        setHighlightRenderKey(prev => prev + 1)
        if (config.debug) {
          console.log('📏 Viewport updated for scale change:', { 
            scale, 
            width: viewport.width, 
            height: viewport.height,
            rotation: viewport.rotation
          })
        }
      } catch (error) {
        console.warn('❌ Failed to update viewport for new scale:', error)
      }
    }
  }, [pdfDocument, currentPage, currentRotation])

  const handleRotationChange = useCallback(async (rotation: number) => {
    setCurrentRotation(rotation)
    
    // Update viewport for new rotation
    if (pdfDocument) {
      try {
        const page = await pdfDocument.getPage(currentPage)
        const viewport = page.getViewport({ scale: currentScale, rotation: rotation })
        setCurrentViewport(viewport)
        // Force highlight re-render on rotation change to ensure proper coordinate sync
        setHighlightRenderKey(prev => prev + 1)
        if (config.debug) {
          console.log('🔄 Viewport updated for rotation change:', { 
            rotation, 
            width: viewport.width, 
            height: viewport.height,
            scale: viewport.scale
          })
        }
      } catch (error) {
        console.warn('❌ Failed to update viewport for new rotation:', error)
      }
    }
  }, [pdfDocument, currentPage, currentScale])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
  }, [])

  const handleSidebarToggle = useCallback((isOpen: boolean) => {
    setSidebarView(isOpen ? 'thumbnails' : 'none')
  }, [])

  const handleSidebarViewChange = useCallback((view: SidebarView) => {
    setSidebarView(view)
  }, [])

  // Removed unused handleZoomModeChange

  const handleToolChange = useCallback((tool: ToolbarTool) => {
    setActiveTool(tool)
  }, [])

  const handleSearch = useCallback((term: string) => {
    console.log('Search:', term)
  }, [])

  const handlePrint = useCallback(() => {
    console.log('Print document')
    window.print()
  }, [])

  const handleDownload = useCallback(() => {
    console.log('Download document')
    // The PDFViewer will handle the default download
  }, [])

  const handleOpenFile = useCallback((newFile: File) => {
    setFile(newFile)
  }, [])

  const handlePresentationMode = useCallback(() => {
    console.log('Presentation mode toggled')
  }, [])

  const handleDocumentInfo = useCallback((info: PDFDocumentInfo) => {
    setDocumentInfo(info)
    console.log('Document info:', info)
  }, [])

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
      {/* Header with Mode Switcher */}
      <div style={{ 
        backgroundColor: '#2c3e50', 
        color: 'white', 
        padding: '20px', 
        textAlign: 'center' 
      }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>🔥 Complete PDF.js Web Viewer</h1>
        <p style={{ margin: '8px 0 12px 0', opacity: 0.9 }}>
          React + TypeScript PDF Viewer with comprehensive Mozilla PDF.js functionality
        </p>
        
        {/* Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px' }}>
          <button
            onClick={() => setAppMode('comprehensive')}
            style={{
              padding: '8px 16px',
              backgroundColor: appMode === 'comprehensive' ? '#007bff' : 'transparent',
              color: 'white',
              border: '2px solid #007bff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            📚 Comprehensive Viewer
          </button>
          <button
            onClick={() => setAppMode('simple')}
            style={{
              padding: '8px 16px',
              backgroundColor: appMode === 'simple' ? '#28a745' : 'transparent',
              color: 'white',
              border: '2px solid #28a745',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🎯 Simple TestPDF
          </button>
        </div>
      </div>

      {/* Conditional Content */}
      {appMode === 'simple' ? (
        // Simple TestPDF Component
        <TestPDFExample />
      ) : (
        // Comprehensive Viewer (existing content)
        <div style={{ display: 'flex', height: 'calc(100vh - 134px)' }}>
        {/* Left panel */}
        <div style={{ 
          width: '350px', 
          backgroundColor: '#f8f9fa', 
          padding: '20px', 
          overflowY: 'auto',
          borderRight: '1px solid #dee2e6'
        }}>
          {/* File Input Section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#2c3e50', marginBottom: '15px', fontSize: '18px' }}>📁 Load PDF</h3>
            
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                📎 Upload File:
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                🌐 Or use URL:
              </label>
              <input
                type="text"
                value={typeof file === 'string' ? file : ''}
                onChange={handleUrlChange}
                placeholder="https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                💡 Try: /compressed.tracemonkey-pldi-09.pdf (local) or the URL above (online)
              </div>
              
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFile(PDFUtils.samples.urls.local_tracemonkey)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  📄 Local Sample
                </button>
                <button
                  onClick={() => setFile(PDFUtils.samples.urls.mozilla_tracemonkey)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🌐 Online Sample
                </button>
              </div>
            </div>
          </div>

                     {/* Enhanced Text Selection Notice */}
           <div style={{ 
             backgroundColor: '#e8f5e8', 
             padding: '15px', 
             borderRadius: '8px', 
             marginBottom: '15px',
             border: '1px solid #4caf50'
           }}>
             <strong style={{ color: '#2e7d32', fontSize: '16px' }}>✨ Comprehensive PDF.js Viewer</strong>
             <div style={{ color: '#424242', marginTop: '8px', lineHeight: 1.5 }}>
               <strong>Complete functionality:</strong> All features from the official Mozilla PDF.js web viewer!
             </div>
             <div style={{ 
               marginTop: '10px', 
               padding: '8px', 
               backgroundColor: '#f1f8e9', 
               borderRadius: '4px',
               fontSize: '14px',
               color: '#33691e'
             }}>
               <strong>🎯 Features:</strong> Sidebar • View modes • Keyboard shortcuts • Search • Print • Download • Presentation mode
             </div>
           </div>

           {/* Text Highlighting Section */}
           <div style={{ 
             backgroundColor: '#e1f5fe', 
             padding: '15px', 
             borderRadius: '8px', 
             marginBottom: '15px',
             border: '1px solid #03a9f4'
           }}>
             <strong style={{ color: '#0277bd', fontSize: '16px' }}>🖍️ Text Highlighting</strong>
             <div style={{ color: '#424242', marginTop: '8px', lineHeight: 1.5 }}>
               <div style={{ marginBottom: '10px' }}>
                 <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                   Enter text to highlight:
                 </label>
                 <textarea
                   value={highlightText}
                   onChange={handleHighlightTextChange}
                   placeholder="Type or paste text you want to highlight in the PDF..."
                   style={{ 
                     width: '100%', 
                     height: '80px',
                     padding: '8px', 
                     border: '1px solid #ddd', 
                     borderRadius: '4px',
                     fontSize: '13px',
                     resize: 'vertical'
                   }}
                 />
               </div>
               
               <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                 <button
                   onClick={handleHighlightText}
                   disabled={!highlightText.trim() || !pdfDocument || isLoading}
                   style={{
                     padding: '6px 12px',
                     fontSize: '12px',
                     backgroundColor: !highlightText.trim() || !pdfDocument || isLoading ? '#ccc' : '#03a9f4',
                     color: 'white',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: !highlightText.trim() || !pdfDocument || isLoading ? 'not-allowed' : 'pointer'
                   }}
                 >
                   {isLoading ? '⏳ Searching...' : '🔍 Highlight Text'}
                 </button>
                 
                 <button
                   onClick={highlightPredefinedText}
                   disabled={!pdfDocument}
                   style={{
                     padding: '6px 12px',
                     fontSize: '12px',
                     backgroundColor: !pdfDocument ? '#ccc' : '#ff9800',
                     color: 'white',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: !pdfDocument ? 'not-allowed' : 'pointer'
                   }}
                 >
                   📄 Highlight Sample Text
                 </button>
                 
                 <button
                   onClick={clearHighlights}
                   style={{
                     padding: '6px 12px',
                     fontSize: '12px',
                     backgroundColor: '#f44336',
                     color: 'white',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer'
                   }}
                 >
                   🗑️ Clear Highlights
                 </button>
               </div>

               {/* Search info */}
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '11px', 
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  🔍 Always searches current page only for optimal performance
                </div>

                {config.enabled && (
                 <div style={{ 
                   padding: '6px', 
                   backgroundColor: apiAvailable ? '#e8f5e8' : '#ffebee', 
                   borderRadius: '4px',
                   fontSize: '11px',
                   color: apiAvailable ? '#2e7d32' : '#c62828',
                   marginBottom: '8px'
                 }}>
                   <strong>PyMuPDF API:</strong> {apiAvailable ? '✅ Available' : '❌ Unavailable'}
                   {!apiAvailable && config.fallbackToBuiltIn && (
                     <div style={{ marginTop: '2px' }}>
                       Using built-in highlighting fallback
                     </div>
                   )}
                 </div>
               )}

               {highlights.length > 0 && (
                 <div style={{ 
                   padding: '8px', 
                   backgroundColor: '#fff8e1', 
                   borderRadius: '4px',
                   fontSize: '12px',
                   color: '#f57c00'
                 }}>
                   <strong>✅ Found {highlights.length} highlight(s)</strong>
                   <div style={{ marginTop: '4px' }}>
                     Highlights are shown with yellow background on the PDF pages.
                     {config.enabled && apiAvailable && ' (Using PyMuPDF API)'}
                     {config.enabled && !apiAvailable && ' (Using built-in fallback)'}
                   </div>
                 </div>
               )}
               
               {error && (
                 <div style={{ 
                   padding: '8px', 
                   backgroundColor: '#ffebee', 
                   borderRadius: '4px',
                   fontSize: '12px',
                   color: '#c62828'
                 }}>
                   <strong>❌ API Error:</strong> {error}
                   {config.fallbackToBuiltIn && (
                     <div style={{ marginTop: '4px' }}>
                       Falling back to built-in highlighting.
                     </div>
                   )}
                 </div>
               )}
               
               {!pdfDocument && (
                 <div style={{ 
                   padding: '8px', 
                   backgroundColor: '#ffebee', 
                   borderRadius: '4px',
                   fontSize: '12px',
                   color: '#c62828'
                 }}>
                   ⚠️ Load a PDF first to enable highlighting functionality
                 </div>
               )}
             </div>
           </div>

          {/* Current State */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>📊 Current State</h4>
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '12px', 
              borderRadius: '6px', 
              border: '1px solid #dee2e6',
              fontSize: '14px',
              lineHeight: 1.6
            }}>
              <div><strong>Page:</strong> {currentPage}</div>
              <div><strong>Scale:</strong> {(currentScale * 100).toFixed(0)}%</div>
              <div><strong>Rotation:</strong> {currentRotation}°</div>
              <div><strong>View Mode:</strong> {viewMode}</div>
              <div><strong>Sidebar:</strong> {sidebarView}</div>
              <div><strong>Zoom Mode:</strong> {zoomMode}</div>
              <div><strong>Tool:</strong> {activeTool}</div>
            </div>
          </div>

          {/* View Mode Controls */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>👁️ View Mode</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(['single', 'continuous', 'two-page', 'book'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleViewModeChange(mode)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #007bff',
                    borderRadius: '4px',
                    backgroundColor: viewMode === mode ? '#007bff' : 'white',
                    color: viewMode === mode ? 'white' : '#007bff',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar Controls */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>🗂️ Sidebar</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(['none', 'thumbnails', 'outline', 'attachments', 'layers'] as SidebarView[]).map(view => (
                <button
                  key={view}
                  onClick={() => handleSidebarViewChange(view)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #28a745',
                    borderRadius: '4px',
                    backgroundColor: sidebarView === view ? '#28a745' : 'white',
                    color: sidebarView === view ? 'white' : '#28a745',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>⌨️ Keyboard Shortcuts</h4>
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '12px', 
              borderRadius: '6px', 
              border: '1px solid #dee2e6',
              fontSize: '12px',
              lineHeight: 1.5
            }}>
              <div><strong>Navigation:</strong> n/j (next), p/k (prev), Home/End</div>
              <div><strong>Zoom:</strong> Ctrl +/- (zoom), Ctrl 0 (actual size)</div>
              <div><strong>Tools:</strong> h (hand), s (selection), r (rotate)</div>
              <div><strong>Search:</strong> Ctrl F (find), Ctrl G (next result)</div>
              <div><strong>File:</strong> Ctrl O (open), Ctrl S (save), Ctrl P (print)</div>
              <div><strong>View:</strong> F4 (sidebar), Ctrl Alt P (presentation)</div>
            </div>
          </div>

          {/* Document Info */}
          {documentInfo && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>ℹ️ Document Info</h4>
              <div style={{ 
                backgroundColor: '#fff', 
                padding: '12px', 
                borderRadius: '6px', 
                border: '1px solid #dee2e6',
                fontSize: '12px',
                lineHeight: 1.5
              }}>
                {documentInfo.Title && <div><strong>Title:</strong> {documentInfo.Title}</div>}
                {documentInfo.Author && <div><strong>Author:</strong> {documentInfo.Author}</div>}
                {documentInfo.Subject && <div><strong>Subject:</strong> {documentInfo.Subject}</div>}
                {documentInfo.Creator && <div><strong>Creator:</strong> {documentInfo.Creator}</div>}
                {documentInfo.Producer && <div><strong>Producer:</strong> {documentInfo.Producer}</div>}
                {documentInfo.CreationDate && <div><strong>Created:</strong> {documentInfo.CreationDate}</div>}
                {documentInfo.ModDate && <div><strong>Modified:</strong> {documentInfo.ModDate}</div>}
                {documentInfo.PDFFormatVersion && <div><strong>PDF Version:</strong> {documentInfo.PDFFormatVersion}</div>}
              </div>
            </div>
          )}

          {/* Worker Debug Panel */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#dc3545', marginBottom: '10px' }}>🔧 PDF.js Worker Status</h4>
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '12px', 
              borderRadius: '6px', 
              border: '1px solid #dee2e6',
              fontSize: '12px'
            }}>
              <div><strong>Configured:</strong> {workerInfo.configured ? '✅' : '❌'}</div>
              <div><strong>Worker Source:</strong> {workerInfo.workerSrc || 'Not set'}</div>
              <div><strong>Retry Count:</strong> {workerInfo.retryCount}</div>
              {workerInfo.testResult && (
                <div style={{ marginTop: '8px', color: workerInfo.testResult.includes('✅') ? '#28a745' : '#dc3545' }}>
                  {workerInfo.testResult}
                </div>
              )}
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={testWorker}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Test Worker
                </button>
                <button
                  onClick={resetWorker}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Reset Worker
                </button>
              </div>
            </div>
          </div>

          {/* Complete Feature List */}
          <div>
            <h4 style={{ color: '#28a745', marginBottom: '10px' }}>⚡ Complete PDF.js Features</h4>
            <ul style={{ color: '#666', lineHeight: 1.6, margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
              <li><strong>🗂️ Sidebar:</strong> Thumbnails, Outline, Attachments, Layers</li>
              <li><strong>👁️ View Modes:</strong> Single, Continuous, Two-page, Book</li>
              <li><strong>🔍 Zoom:</strong> Fit to page, Fit to width, Actual size</li>
              <li><strong>🛠️ Tools:</strong> Hand/Pan, Text selection, Annotation</li>
              <li><strong>🔎 Search:</strong> Find text with result navigation</li>
              <li><strong>📱 Responsive:</strong> Mobile-friendly design</li>
              <li><strong>⌨️ Keyboard:</strong> All official PDF.js shortcuts</li>
              <li><strong>🎦 Presentation:</strong> Full-screen mode</li>
              <li><strong>🖨️ Print & Download:</strong> Full document export</li>
              <li><strong>ℹ️ Document Info:</strong> Metadata display</li>
              <li><strong>🔄 Rotation:</strong> Clockwise/counter-clockwise</li>
              <li><strong>⚡ Performance:</strong> Hardware-accelerated rendering</li>
              <li><strong>🌊 Smooth Selection:</strong> Enhanced text selection</li>
              <li><strong>🛡️ Error Recovery:</strong> Robust worker handling</li>
              <li><strong>🔧 TypeScript:</strong> Full type safety</li>
            </ul>
          </div>
        </div>

        {/* PDF Viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <PDFViewer
            key={`pdf-viewer-${highlightRenderKey}`} // Force re-render when highlights change
            file={file}
            page={currentPage}
            scale={currentScale}
            rotation={currentRotation}
            viewMode={viewMode}
            sidebarView={sidebarView}
            zoomMode={zoomMode}
            activeTool={activeTool}
            enableKeyboardShortcuts={true}
            onDocumentLoad={handleDocumentLoad}
            onPageChange={handlePageChange}
            onScaleChange={handleScaleChange}
            onRotationChange={handleRotationChange}
            onViewModeChange={handleViewModeChange}
            onSidebarToggle={handleSidebarToggle}
            onSidebarViewChange={handleSidebarViewChange}
            onToolChange={handleToolChange}
            onError={handleError}
            onSearch={handleSearch}
            onPrint={handlePrint}
            onDownload={handleDownload}
            onOpenFile={handleOpenFile}
            onPresentationMode={handlePresentationMode}
            onDocumentInfo={handleDocumentInfo}
            highlights={highlights}
            enableTextSelection={true}
            renderToolbar={true}
            renderSidebar={true}
            width="100%"
            height="100%"
            enableAnnotations={true}
            enableForms={true}
            enableSearch={true}
            enableThumbnails={true}
            showPageControls={true}
            showZoomControls={true}
            showRotateControls={true}
            showViewModeControls={true}
            showOpenOption={true}
            showSearchOption={true}
            showPrintOption={true}
            showDownloadOption={true}
            showToolSelection={true}
            showFitOptions={true}
            showPresentationMode={true}
          />
        </div>
      </div>
      )}
    </div>
  )
}

export default App 