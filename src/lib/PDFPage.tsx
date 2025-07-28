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

  // Matrix multiplication utility (standard PDF.js method)
  const multiplyTransforms = useCallback((a: number[], b: number[]): number[] => {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5]
    ]
  }, [])

  // Official PDF.js text transformation method (based on Mozilla examples)
  const transformTextItem = useCallback((viewport: PDFPageViewport, textItem: any, ctx: CanvasRenderingContext2D, style: any) => {
    // This is the exact transformation method used in official PDF.js examples
    // First transform: viewport.transform combined with textItem.transform
    const combinedTransform = multiplyTransforms(viewport.transform, textItem.transform)
    
    // Second transform: apply Y-flip matrix [1, 0, 0, -1, 0, 0] as per PDF.js standard
    const tx = multiplyTransforms(combinedTransform, [1, 0, 0, -1, 0, 0])
    
    // Calculate font size from transformation matrix
    const fontSize = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]))
    
    // Adjust for font ascent/descent (official PDF.js method)
    if (style.ascent) {
      tx[5] -= fontSize * style.ascent
    } else if (style.descent) {
      tx[5] -= fontSize * (1 + style.descent)
    } else {
      tx[5] -= fontSize / 2
    }
    
    // Adjust for rendered width (as per official examples)
    if (textItem.width > 0) {
      ctx.font = `${fontSize}px ${style.fontFamily || 'Arial'}`
      const measuredWidth = ctx.measureText(textItem.str).width
      
      if (measuredWidth > 0) {
        tx[0] = (textItem.width * viewport.scale) / measuredWidth
      }
    }
    
    return tx
  }, [multiplyTransforms])

  // FIX #2: Simplified direct scaling approach for text layer after zoom (kept for reference)
  const renderTextLayerSimple = useCallback(async (pdfPage: PDFPageProxy, pdfViewport: PDFPageViewport) => {
    if (!textLayerRef.current) return

    try {
      console.debug(`FIX #2: Simplified text layer for page ${pageNumber} at scale ${scale}`)
      
      // Clear existing text layer completely
      textLayerRef.current.innerHTML = ''
      textLayerRef.current.style.width = `${pdfViewport.width}px`
      textLayerRef.current.style.height = `${pdfViewport.height}px`
      
      // Force a reflow to ensure dimensions are applied
      textLayerRef.current.offsetHeight

      // Get text content for positioning
      const textContent = await pdfPage.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false
      })
      
      if (textContent.items.length === 0) return

      // FIX #2: Direct scaling approach - render each text item directly with viewport scaling
      textContent.items.forEach((textItem: any) => {
        if (!textItem.str || typeof textItem.str !== 'string') return
        if (!textItem.transform || textItem.transform.length < 6) return

        // Extract transformation values
        const [scaleX, skewY, skewX, scaleY, translateX, translateY] = textItem.transform
        
        // Get style information
        const style = textContent.styles[textItem.fontName] || {}
        
        // Calculate actual font size from matrix
        const fontSize = Math.abs(scaleY) * pdfViewport.scale
        
        // Calculate position with viewport scaling applied
        const left = translateX * pdfViewport.scale
        const top = (pdfViewport.height - translateY * pdfViewport.scale - fontSize)
        
        // Create span element with direct positioning
        const textSpan = document.createElement('span')
        textSpan.textContent = textItem.str
        textSpan.style.position = 'absolute'
        textSpan.style.whiteSpace = 'pre'
        textSpan.style.color = 'transparent'
        textSpan.style.cursor = 'text'
        textSpan.style.userSelect = 'text'
        textSpan.style.pointerEvents = 'auto'
        
        // Apply calculated positioning and scaling
        textSpan.style.left = `${left}px`
        textSpan.style.top = `${top}px`
        textSpan.style.fontSize = `${fontSize}px`
        textSpan.style.fontFamily = style.fontFamily || 'Arial, sans-serif'
        
        // Apply horizontal scaling if needed
        if (textItem.width > 0 && Math.abs(scaleX) > 0.01) {
          const scaleXAdjusted = (textItem.width * pdfViewport.scale) / (textItem.str.length * fontSize * 0.6)
          if (scaleXAdjusted !== 1) {
            textSpan.style.transform = `scaleX(${scaleXAdjusted})`
            textSpan.style.transformOrigin = 'left bottom'
          }
        }
        
        textLayerRef.current?.appendChild(textSpan)
      })

    } catch (error) {
      console.error('Error rendering simplified text layer:', error)
      if (onError) {
        onError(new Error(`Simplified text layer rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
  }, [pageNumber, scale, enableTextSelection, onError])

  // FIX #3: Hybrid approach with forced re-rendering and scale detection
  const renderTextLayerHybrid = useCallback(async (pdfPage: PDFPageProxy, pdfViewport: PDFPageViewport) => {
    if (!textLayerRef.current) return

    try {
      console.debug(`FIX #3: Hybrid text layer for page ${pageNumber} at scale ${scale}`)
      
      // Clear existing text layer completely
      textLayerRef.current.innerHTML = ''
      textLayerRef.current.style.width = `${pdfViewport.width}px`
      textLayerRef.current.style.height = `${pdfViewport.height}px`
      
      // Add scale tracking attribute for debugging
      textLayerRef.current.setAttribute('data-current-scale', scale.toString())
      
      // Force a reflow to ensure dimensions are applied
      textLayerRef.current.offsetHeight

      // Get text content for positioning
      const textContent = await pdfPage.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false
      })
      
      if (textContent.items.length === 0) return

      // FIX #3: Hybrid approach - use viewport transforms but with forced positioning
      textContent.items.forEach((textItem: any) => {
        if (!textItem.str || typeof textItem.str !== 'string') return
        if (!textItem.transform || textItem.transform.length < 6) return

        // Extract transformation values
        const [scaleX, skewY, skewX, scaleY, translateX, translateY] = textItem.transform
        
        // Get style information
        const style = textContent.styles[textItem.fontName] || {}
        
        // Use hybrid approach: combine viewport scaling with original positioning
        const fontSize = Math.abs(scaleY)
        const actualFontSize = fontSize * pdfViewport.scale
        
        // More accurate positioning calculation
        const left = translateX * pdfViewport.scale
        const top = pdfViewport.height - (translateY * pdfViewport.scale) - actualFontSize
        
        // Create span element with hybrid positioning
        const textSpan = document.createElement('span')
        textSpan.textContent = textItem.str
        textSpan.style.position = 'absolute'
        textSpan.style.whiteSpace = 'pre'
        textSpan.style.color = 'transparent'
        textSpan.style.cursor = 'text'
        textSpan.style.userSelect = 'text'
        textSpan.style.pointerEvents = 'auto'
        textSpan.style.display = 'inline-block'
        textSpan.style.transformOrigin = 'left bottom'
        
        // Apply hybrid positioning and scaling
        textSpan.style.left = `${left}px`
        textSpan.style.top = `${top}px`
        textSpan.style.fontSize = `${actualFontSize}px`
        textSpan.style.fontFamily = style.fontFamily || 'Arial, sans-serif'
        
        // Apply width adjustment with better calculation
        if (textItem.width > 0) {
          const expectedWidth = textItem.str.length * actualFontSize * 0.6
          const actualWidth = textItem.width * pdfViewport.scale
          const widthScale = actualWidth / expectedWidth
          
          if (Math.abs(widthScale - 1) > 0.1) { // Only scale if significantly different
            textSpan.style.transform = `scaleX(${widthScale})`
          }
        }
        
        // Add debugging attributes
        textSpan.setAttribute('data-original-font-size', fontSize.toString())
        textSpan.setAttribute('data-scale', pdfViewport.scale.toString())
        textSpan.setAttribute('data-text', textItem.str.substring(0, 10))
        
        textLayerRef.current?.appendChild(textSpan)
      })

    } catch (error) {
      console.error('Error rendering hybrid text layer:', error)
      if (onError) {
        onError(new Error(`Hybrid text layer rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
  }, [pageNumber, scale, enableTextSelection, onError])

  // Render text layer using simplified approach (FIX #2 active)
  const renderTextLayer = useCallback(async (pdfPage: PDFPageProxy, pdfViewport: PDFPageViewport) => {
    // Use FIX #3: Hybrid approach for most reliability
    return renderTextLayerHybrid(pdfPage, pdfViewport)

    /*
    // FIX #2: Use simplified approach for now - it's more reliable for zoom scaling
    return renderTextLayerSimple(pdfPage, pdfViewport)

    // Original complex approach kept for reference
    if (!textLayerRef.current) return

    try {
      console.debug(`Rendering text layer for page ${pageNumber} at scale ${scale} using official PDF.js method`)
      
      // Clear existing text layer completely
      textLayerRef.current.innerHTML = ''
      textLayerRef.current.style.width = `${pdfViewport.width}px`
      textLayerRef.current.style.height = `${pdfViewport.height}px`
      
      // Force a reflow to ensure dimensions are applied
      textLayerRef.current.offsetHeight

      // Get text content for positioning
      const textContent = await pdfPage.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false
      })
      
      if (textContent.items.length === 0) return

      // Create a temporary canvas for font measurement (as per official examples)
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')!

      // Render each text item using official PDF.js transformation method
      textContent.items.forEach((textItem: any) => {
        if (!textItem.str || typeof textItem.str !== 'string') return
        if (!textItem.transform || textItem.transform.length < 6) return

        // Get style information
        const style = textContent.styles[textItem.fontName] || {}

        // Apply official PDF.js transformation method
        // This is the key transformation used in Mozilla's examples
        const tx = transformTextItem(pdfViewport, textItem, tempCtx, style)
        
        // Create span element with proper positioning
        const textSpan = document.createElement('span')
        textSpan.textContent = textItem.str
        textSpan.style.position = 'absolute'
        textSpan.style.whiteSpace = 'pre'
        textSpan.style.cursor = 'text'
        textSpan.style.transformOrigin = 'left bottom'
        textSpan.style.userSelect = 'text'
        textSpan.style.pointerEvents = 'auto'
        
        // Apply calculated transformation and positioning
        const fontSize = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]))
        textSpan.style.fontSize = `${fontSize}px`
        textSpan.style.fontFamily = style.fontFamily || 'Arial, sans-serif'
        textSpan.style.left = `${tx[4]}px`
        textSpan.style.top = `${tx[5]}px`
        
        // Apply scaling if needed
        if (tx[0] !== 1 || tx[3] !== 1) {
          textSpan.style.transform = `scaleX(${tx[0]})`
        }
        
        textLayerRef.current?.appendChild(textSpan)
      })

    } catch (error) {
      console.error('Error rendering text layer:', error)
      if (onError) {
        onError(new Error(`Text layer rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
    */
  }, [pageNumber, scale, enableTextSelection, onError, renderTextLayerHybrid])

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
    // Ensure text layer is above canvas but below highlights
    zIndex: 1,
    // Performance optimizations for smooth selection
    willChange: 'transform',
    transform: 'translateZ(0)', // Force hardware acceleration
    contain: 'layout style paint',
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
        <div style={highlightLayerStyle} className="pdf-highlight-layer">
          <PDFHighlight
            highlights={highlights.filter(h => h.pageNumber === pageNumber)}
            pageNumber={pageNumber}
            viewport={viewport}
          />
        </div>
      )}
    </div>
  )
}

export default PDFPage 