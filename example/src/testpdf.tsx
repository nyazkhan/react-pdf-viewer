import React, { useState, useCallback, useEffect } from 'react'
import {
  PDFViewer,
  type PDFDocumentProxy,
  type PDFHighlightType,
  type PDFRect
} from '../../dist/index.mjs'
import '../../dist/styles/viewer.css'

interface TestPDFProps {
  pageNumber: number
  referenceText: string
  fileUrl: string
}

const TestPDF: React.FC<TestPDFProps> = ({ pageNumber, referenceText, fileUrl }) => {
  const [highlights, setHighlights] = useState<PDFHighlightType[]>([])
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [isHighlighting, setIsHighlighting] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')

  // Debug logging when highlights change
  console.log('TestPDF render: highlights =', highlights)

  // Function to create highlights for the reference text
  const createHighlightForText = useCallback(async (searchText: string, targetPage: number) => {
    if (!pdfDocument || !searchText.trim()) {
      setDebugInfo('❌ No PDF document or search text provided')
      return
    }

    setIsHighlighting(true)
    setDebugInfo('🔍 Starting text search...')
    const newHighlights: PDFHighlightType[] = []
    
    try {
      // Check if page exists
      if (targetPage > pdfDocument.numPages || targetPage < 1) {
        setDebugInfo(`❌ Page ${targetPage} doesn't exist (PDF has ${pdfDocument.numPages} pages)`)
        return
      }

      // Only search on the specified page
      const page = await pdfDocument.getPage(targetPage)
      setDebugInfo(`📄 Loaded page ${targetPage}`)
      
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1.0 })
      setDebugInfo(`📖 Text content loaded: ${textContent.items.length} items`)
      
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
      
      setDebugInfo(`📝 Full text length: ${fullText.length} characters`)
      console.log('Full text preview:', fullText.substring(0, 200))
      
      // Search for the text (case-insensitive)
      const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      let match
      let matchCount = 0
      
      while ((match = searchRegex.exec(fullText)) !== null) {
        matchCount++
        const startIndex = match.index
        const endIndex = startIndex + match[0].length
        
        console.log(`Found match ${matchCount}:`, {
          text: match[0],
          startIndex,
          endIndex,
          context: fullText.substring(Math.max(0, startIndex - 20), endIndex + 20)
        })
        
        // Find text items that contain this match
        const rects: PDFRect[] = []
        
        for (const textItem of textItems) {
          // Check if this text item overlaps with our match
          if (textItem.endIndex > startIndex && textItem.startIndex < endIndex) {
            const [scaleX, skewY, skewX, scaleY, translateX, translateY] = textItem.transform
            
            // Calculate the rectangle for this text item using PDF coordinates
            const fontSize = Math.abs(scaleY)
            const left = translateX
            const top = translateY
            const width = textItem.width || Math.abs(scaleX) * textItem.text.length
            const height = fontSize
            
            console.log(`Text item coordinates:`, {
              text: textItem.text,
              fontSize,
              left,
              top,
              width,
              height,
              transform: textItem.transform
            })
            
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
            id: `reference-highlight-${targetPage}-${startIndex}`,
            pageNumber: targetPage,
            rects: rects,
            color: '#ffff00', // Yellow highlight
            opacity: 0.6, // More visible
            content: match[0]
          }
          
          console.log(`Created highlight:`, highlight)
          newHighlights.push(highlight)
        }
      }
      
      setDebugInfo(`✅ Found ${newHighlights.length} highlights for "${searchText}"`)
      console.log(`Final highlights:`, newHighlights)
      setHighlights(newHighlights)
      
      // Debug: Verify highlights state was updated
      console.log('Highlights state updated, current highlights:', newHighlights)
      
    } catch (error) {
      console.error('Error creating highlights:', error)
      setDebugInfo(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsHighlighting(false)
    }
  }, [pdfDocument])

  // Handle PDF document load
  const handleDocumentLoad = useCallback((pdf: PDFDocumentProxy) => {
    console.log('PDF loaded:', pdf.numPages, 'pages')
    setDebugInfo(`📚 PDF loaded: ${pdf.numPages} pages`)
    setPdfDocument(pdf)
  }, [])

  // Auto-highlight reference text when PDF loads
  useEffect(() => {
    if (pdfDocument && referenceText && pageNumber) {
      setDebugInfo('⏳ Preparing to highlight...')
      
      // Add a test highlight first to verify the rendering system works
      const testHighlight: PDFHighlightType = {
        id: 'test-highlight',
        pageNumber: pageNumber,
        rects: [{
          left: 100,
          top: 100,
          width: 200,
          height: 20
        }],
        color: '#ff0000',
        opacity: 0.5,
        content: 'Test highlight'
      }
      
      setHighlights([testHighlight])
      setDebugInfo('🧪 Test highlight added')
      
      // Then try to find the actual text
      const timer = setTimeout(() => {
        createHighlightForText(referenceText, pageNumber)
      }, 1000) // Increased delay
      
      return () => clearTimeout(timer)
    }
  }, [pdfDocument, referenceText, pageNumber, createHighlightForText])

  // Handle errors
  const handleError = useCallback((error: Error) => {
    console.error('PDF error:', error)
    setDebugInfo(`❌ PDF Error: ${error.message}`)
  }, [])

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Loading indicator */}
      {isHighlighting && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '10px',
            background: '#007bff',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            zIndex: 1000
          }}
        >
          🔍 Highlighting reference text...
        </div>
      )}

      {/* Debug info panel */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '12px',
          maxWidth: '350px',
          zIndex: 1000,
          fontFamily: 'monospace'
        }}
      >
        <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>
          🔧 Debug Info
        </div>
        <div><strong>📄 Page:</strong> {pageNumber}</div>
        <div><strong>🔍 Reference:</strong> {referenceText.substring(0, 30)}...</div>
        <div><strong>🎯 Highlights:</strong> {highlights.length} found</div>
        <div><strong>📊 Status:</strong> {debugInfo}</div>
        <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.8 }}>
          Check browser console for detailed logs
        </div>
      </div>

      {/* Manual refresh button */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000
        }}
      >
        <button
          onClick={() => {
            if (pdfDocument && referenceText && pageNumber) {
              createHighlightForText(referenceText, pageNumber)
            }
          }}
          disabled={!pdfDocument || isHighlighting}
          style={{
            padding: '8px 12px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: pdfDocument && !isHighlighting ? 'pointer' : 'not-allowed',
            fontSize: '12px'
          }}
        >
          🔄 Retry Highlight
        </button>
      </div>

      {/* PDF Viewer */}
      <PDFViewer
        file={fileUrl}
        page={pageNumber}
        highlights={highlights}
        enableTextSelection={true}
        enableKeyboardShortcuts={true}
        onDocumentLoad={handleDocumentLoad}
        onError={handleError}
        width="100%"
        height="100%"
        renderToolbar={true}
        renderSidebar={false} // Hide sidebar for cleaner view
        showPageControls={true}
        showZoomControls={true}
        showSearchOption={false} // Hide search since we're auto-highlighting
      />
      
      {/* Debug: Show highlights data */}
      {highlights.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(255, 0, 0, 0.9)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'monospace',
            maxWidth: '400px',
            zIndex: 1000
          }}
        >
          <div><strong>🎯 Highlights Debug:</strong></div>
          <div>Count: {highlights.length}</div>
          {highlights.map((h, i) => (
            <div key={i} style={{ marginTop: '4px' }}>
              #{i+1}: Page {h.pageNumber}, Rects: {h.rects.length}, 
              Pos: ({h.rects[0]?.left.toFixed(1)}, {h.rects[0]?.top.toFixed(1)})
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TestPDF
