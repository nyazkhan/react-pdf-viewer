import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { 
  PDFPageProps, 
  PDFPageProxy, 
  PDFPageViewport,
  PDFRenderContext,
  PDFRenderTask
} from './types'
import { PDFHighlight } from './PDFHighlight'

export const PDFPage: React.FC<PDFPageProps> = ({
  pageNumber,
  scale = 1.0,
  rotation = 0,
  pdf,
  onPageRender,
  onError,
  className = '',
  style,
  enableTextSelection = true,
  highlights = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderingRef = useRef<boolean>(false)
  const renderTaskRef = useRef<PDFRenderTask | null>(null)
  
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [viewport, setViewport] = useState<PDFPageViewport | null>(null)
  const [rendering, setRendering] = useState(false)

  // Cancel any ongoing render task
  const cancelRender = useCallback(() => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch (error) {
        // Handle cases where render task is already destroyed/terminated
        console.warn('Error canceling render task:', error)
      }
      renderTaskRef.current = null
    }
  }, []) // No dependencies needed since we use ref

  // Render page to canvas
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return

    // Prevent concurrent renders using ref to avoid dependency loop
    if (renderingRef.current) {
      console.debug('Render already in progress, skipping')
      return
    }

    try {
      renderingRef.current = true
      setRendering(true)
      cancelRender()

      // Get the page
      const pdfPage = await pdf.getPage(pageNumber)
      setPage(pdfPage)

      // Calculate viewport
      const pdfViewport = pdfPage.getViewport({ scale, rotation })
      setViewport(pdfViewport)

      // Prepare canvas
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Could not get canvas context')
      }

      canvas.height = pdfViewport.height
      canvas.width = pdfViewport.width

      // Clear text layer immediately to prevent misaligned text during render
      if (enableTextSelection && textLayerRef.current) {
        textLayerRef.current.innerHTML = ''
        textLayerRef.current.style.width = `${pdfViewport.width}px`
        textLayerRef.current.style.height = `${pdfViewport.height}px`
      }

      // Render the page
      const renderContext: PDFRenderContext = {
        canvasContext: context,
        viewport: pdfViewport,
        background: 'white',
      }

      const task = pdfPage.render(renderContext)
      renderTaskRef.current = task

      await task.promise

      // Small delay to ensure canvas rendering is complete before text layer
      await new Promise(resolve => setTimeout(resolve, 100))

      // Render text layer for text selection after canvas is complete
      if (enableTextSelection && textLayerRef.current) {
        await renderTextLayer(pdfPage, pdfViewport)
      }

      if (onPageRender) {
        onPageRender(pdfPage)
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'RenderingCancelledException') {
        // Rendering was cancelled, this is normal
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to render page'
      
      // Handle transport/worker destroyed errors gracefully
      if (errorMessage.includes('Transport destroyed') || 
          errorMessage.includes('Worker was terminated') ||
          errorMessage.includes('destroyed')) {
        console.warn('PDF page render interrupted due to worker termination:', errorMessage)
        // Don't propagate worker destruction errors to parent - they will be handled by the loader
        return
      }
      
      console.error('PDF page render error:', errorMessage)
      if (onError) {
        onError(new Error(errorMessage))
      }
    } finally {
      renderingRef.current = false
      setRendering(false)
      renderTaskRef.current = null
    }
  }, [pdf, pageNumber, scale, rotation, enableTextSelection, onPageRender, onError])

  // Proper PDF.js TextLayer implementation for accurate text selection
  const renderTextLayer = useCallback(async (pdfPage: PDFPageProxy, pdfViewport: PDFPageViewport) => {
    if (!textLayerRef.current) return

    try {
      console.debug(`Rendering text layer for page ${pageNumber} at scale ${pdfViewport.scale}`)
      
      // Clear existing text layer completely
      textLayerRef.current.innerHTML = ''
      textLayerRef.current.style.width = `${pdfViewport.width}px`
      textLayerRef.current.style.height = `${pdfViewport.height}px`
      
      // Get text content
      const textContent = await pdfPage.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false
      })
      
      if (textContent.items.length === 0) return

      // Use PDF.js standard approach for text positioning with proper scaling
      textContent.items.forEach((textItem: any, index: number) => {
        if (!textItem.str || typeof textItem.str !== 'string' || textItem.str.trim() === '') return
        if (!textItem.transform || textItem.transform.length < 6) return

        const [scaleX, skewY, skewX, scaleY, translateX, translateY] = textItem.transform
        const style = textContent.styles[textItem.fontName] || {}
        
        // Calculate font size and apply viewport scale
        const fontSize = Math.sqrt(scaleX * scaleX + skewY * skewY) * pdfViewport.scale
        const fontHeight = Math.sqrt(skewX * skewX + scaleY * scaleY) * pdfViewport.scale
        
        // Apply viewport transformation to position
        const left = translateX * pdfViewport.scale
        const top = (translateY - Math.sqrt(skewX * skewX + scaleY * scaleY)) * pdfViewport.scale
        
        // Create text span with proper PDF.js positioning
        const textSpan = document.createElement('span')
        textSpan.textContent = textItem.str
        textSpan.style.position = 'absolute'
        textSpan.style.whiteSpace = 'pre'
        textSpan.style.color = 'transparent'
        textSpan.style.fontSize = `${fontSize}px`
        textSpan.style.fontFamily = style.fontFamily || 'sans-serif'
        textSpan.style.left = `${left}px`
        textSpan.style.top = `${top}px`
        
        // Handle text scaling (important for proper selection)
        if (textItem.width > 0) {
          const textWidth = textItem.width * pdfViewport.scale
          textSpan.style.width = `${textWidth}px`
          
          // Calculate horizontal scaling if needed
          const ctx = document.createElement('canvas').getContext('2d')!
          ctx.font = `${fontSize}px ${style.fontFamily || 'sans-serif'}`
          const measuredWidth = ctx.measureText(textItem.str).width
          
          if (measuredWidth > 0) {
            const scaleFactorX = textWidth / measuredWidth
            if (Math.abs(scaleFactorX - 1) > 0.01) {
              textSpan.style.transform = `scaleX(${scaleFactorX})`
              textSpan.style.transformOrigin = '0% 0%'
            }
          }
        }
        
        // Essential styles for text selection
        textSpan.style.userSelect = 'text'
        textSpan.style.pointerEvents = 'auto'
        textSpan.style.cursor = 'text'
        
        // Add to text layer
        textLayerRef.current?.appendChild(textSpan)
      })

    } catch (error) {
      console.error('Error rendering text layer:', error)
      if (onError) {
        onError(new Error(`Text layer rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
  }, [pageNumber, enableTextSelection, onError])

  // Render when dependencies change
  useEffect(() => {
    renderPage()
  }, [renderPage]) // Now stable since fewer dependencies

  // Force text layer re-render when scale changes to fix text selection after zoom
  useEffect(() => {
    if (page && viewport && enableTextSelection && textLayerRef.current && !rendering) {
      // Small delay to ensure viewport is fully updated
      const timeoutId = setTimeout(() => {
        console.debug(`Scale changed to ${scale}, re-rendering text layer`)
        renderTextLayer(page, viewport).catch(error => {
          console.warn('Failed to re-render text layer after scale change:', error)
        })
      }, 50)
      
      return () => clearTimeout(timeoutId)
    }
  }, [scale, page, viewport, enableTextSelection, rendering, renderTextLayer])

  // Cleanup on unmount
  useEffect(() => {
    return cancelRender
  }, [cancelRender])

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    backgroundColor: 'white',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    margin: '10px',
    ...style,
  }

  const canvasStyle: React.CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
  }

  const textLayerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: viewport ? `${viewport.width}px` : '100%',
    height: viewport ? `${viewport.height}px` : '100%',
    overflow: 'hidden',
    lineHeight: 1,
    userSelect: enableTextSelection ? 'text' : 'none',
    pointerEvents: enableTextSelection ? 'auto' : 'none',
    cursor: enableTextSelection ? 'text' : 'default',
    // Ensure text layer is above canvas but below highlights
    zIndex: 1,
    // Ensure crisp text rendering without GPU acceleration that can break alignment
    fontSmooth: 'always',
    WebkitFontSmoothing: 'antialiased',
    // Prevent text selection highlighting from showing (since text is transparent)
    WebkitUserSelect: enableTextSelection ? 'text' : 'none',
    MozUserSelect: enableTextSelection ? 'text' : 'none',
    msUserSelect: enableTextSelection ? 'text' : 'none',
  }

  const highlightLayerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    // Ensure highlights are above text layer
    zIndex: 2,
  }

  return (
    <div 
      className={`pdf-page ${className}`} 
      style={containerStyle}
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        style={canvasStyle}
      />
      
      {enableTextSelection && (
        <div
          ref={textLayerRef}
          style={textLayerStyle}
          className="pdf-text-layer"
        />
      )}
      
      {highlights.length > 0 && viewport && (
        (() => {
          const pageHighlights = highlights.filter(h => h.pageNumber === pageNumber)
          
          // Debug logging for highlights
          console.log(`📄 PDFPage rendering highlights for page ${pageNumber}:`, {
            totalHighlights: highlights.length,
            pageHighlights: pageHighlights.length,
            viewport: { width: viewport.width, height: viewport.height, scale: viewport.scale },
            pageHighlightsDetails: pageHighlights.map(h => ({
              id: h.id,
              rectsCount: h.rects.length,
              content: h.content?.substring(0, 30) + '...'
            }))
          })
          
          return (
            <div style={highlightLayerStyle} className="pdf-highlight-layer">
              <PDFHighlight
                highlights={pageHighlights}
                pageNumber={pageNumber}
                viewport={viewport}
              />
            </div>
          )
        })()
      )}
    </div>
  )
}

export default PDFPage 