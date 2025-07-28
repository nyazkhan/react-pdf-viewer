import React, { useState, useCallback } from 'react';
import { PDFViewer, type PDFDocumentProxy, type PDFHighlightType, type PDFRect } from '../../dist/index.mjs';
import '../../dist/styles/viewer.css';

interface TestPDFProps {
  pageNumber?: number;
  referenceText?: string;
  fileUrl?: string;
}

const TestPDFExample: React.FC<TestPDFProps> = ({
  pageNumber = 5,
  referenceText = "Safeguarding account is held with an appropriate institution as definedby the Approach Docu",
  fileUrl = "https://storage.googleapis.com/zango_temp/NWC%20Customer%20Funds%20Protection%20Policy%20V2.6%20October%202024.pdf"
}) => {
  const [highlights, setHighlights] = useState<PDFHighlightType[]>([]);
  const [, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState('🎯 Ready to load PDF...');
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);

  // Create highlights from text search - using the same logic as App.tsx
  const createHighlightsForText = useCallback(async (searchText: string, pdf: PDFDocumentProxy) => {
    if (!pdf || !searchText.trim()) {
      console.log('No PDF or search text provided');
      return;
    }

    console.log('🔍 Starting text search for:', searchText.substring(0, 50) + '...');
    setDebugInfo('🔍 Searching for text...');
    
    const newHighlights: PDFHighlightType[] = [];
    
    try {
      // Search through all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`📄 Searching page ${pageNum}/${pdf.numPages}`);
        
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        // Use scale 1.0 for coordinate calculation, scaling will be applied during rendering
        // Get viewport for coordinate calculations
        page.getViewport({ scale: 1.0 });
        
        // Combine all text items into a single string with position tracking
        let fullText = '';
        const textItems: any[] = [];
        
        textContent.items.forEach((item: any) => {
          if (item.str && typeof item.str === 'string') {
            textItems.push({
              text: item.str,
              startIndex: fullText.length,
              endIndex: fullText.length + item.str.length,
              transform: item.transform,
              width: item.width,
              height: item.height
            });
            fullText += item.str;
          }
        });
        
        // Search for the text (case-insensitive)
        const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        
        while ((match = searchRegex.exec(fullText)) !== null) {
          console.log(`✅ Found match on page ${pageNum} at position ${match.index}`);
          
          const startIndex = match.index;
          const endIndex = startIndex + match[0].length;
          
          // Find text items that contain this match
          const rects: PDFRect[] = [];
          
          for (const textItem of textItems) {
            // Check if this text item overlaps with our match
            if (textItem.endIndex > startIndex && textItem.startIndex < endIndex) {
              const [scaleX, , , scaleY, translateX, translateY] = textItem.transform;
              
              // Calculate the rectangle for this text item using PDF coordinates
              // PDFHighlight component will handle viewport scaling
              const fontSize = Math.abs(scaleY);
              const left = translateX;
              const top = translateY; // Use original Y coordinate
              const width = textItem.width || Math.abs(scaleX) * textItem.text.length;
              const height = fontSize;
              
              rects.push({
                left: left,
                top: top,
                width: width,
                height: height
              });
            }
          }
          
          if (rects.length > 0) {
            const highlight = {
              id: `highlight-${pageNum}-${startIndex}`,
              pageNumber: pageNum,
              rects: rects,
              color: '#ffff00',
              opacity: 0.3,
              content: match[0]
            };
            
            newHighlights.push(highlight);
          }
        }
      }
      
      console.log(`🎯 Found ${newHighlights.length} highlights for "${searchText.substring(0, 30)}..."`);
      setHighlights(newHighlights);
      setDebugInfo(`✅ Found ${newHighlights.length} highlights`);
      
    } catch (error) {
      console.error('❌ Error creating highlights:', error);
      setDebugInfo('❌ Error during text search');
    }
  }, []);

  // Handle document load
  const handleDocumentLoad = useCallback((pdf: PDFDocumentProxy) => {
    console.log('📚 PDF Document loaded successfully:', {
      numPages: pdf.numPages,
      fingerprints: pdf.fingerprints,
    });
    
    setPdfDocument(pdf);
    setLoading(false);
    setError(null);
    setDebugInfo(`📚 PDF loaded: ${pdf.numPages} pages`);
    
    // Automatically create highlights for reference text
    if (referenceText && referenceText.trim()) {
      console.log('🎯 Auto-highlighting reference text...');
      createHighlightsForText(referenceText, pdf);
    }
  }, [referenceText, createHighlightsForText]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    console.error('❌ PDF Error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    setError(error.message);
    setDebugInfo(`❌ Error: ${error.message}`);
    setLoading(false);
  }, []);

  // Manual highlight trigger for testing
  const handleManualHighlight = useCallback(() => {
    if (pdfDocument && referenceText) {
      console.log('🔄 Manual highlight triggered');
      setDebugInfo('🔄 Re-highlighting text...');
      createHighlightsForText(referenceText, pdfDocument);
    }
  }, [pdfDocument, referenceText, createHighlightsForText]);

  // Clear highlights
  const handleClearHighlights = useCallback(() => {
    console.log('🗑️ Clearing highlights');
    setHighlights([]);
    setDebugInfo('🗑️ Highlights cleared');
  }, []);

  return (
    <div style={{ height: '90vh', width: '100%', position: 'relative' }}>
      {/* Enhanced Debug Panel */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 1000,
          maxWidth: '320px',
          fontFamily: 'monospace'
        }}
      >
        <div><strong>🎯 TestPDF Debug Panel</strong></div>
        <div>📄 Page: {pageNumber}</div>
        <div>🔗 URL: {fileUrl ? 'Provided' : 'None'}</div>
        <div>📝 Reference Text: {referenceText ? `${referenceText.length} chars` : 'None'}</div>
        <div>🎨 Highlights: {highlights.length}</div>
        <div>📊 Status: {debugInfo}</div>
        <div style={{ marginTop: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              onClick={handleManualHighlight}
              disabled={!pdfDocument || !referenceText}
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                backgroundColor: !pdfDocument || !referenceText ? '#555' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: !pdfDocument || !referenceText ? 'not-allowed' : 'pointer'
              }}
            >
              🔍 Re-highlight
            </button>
            <button
              onClick={handleClearHighlights}
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer - Using library's built-in URL loading */}
      <PDFViewer
        file={fileUrl}
        page={pageNumber}
        highlights={highlights}
        viewMode="continuous"
        sidebarView="none"
        enableTextSelection={true}
        renderToolbar={true}
        renderSidebar={false}
        showPageControls={true}
        showZoomControls={true}
        width="100%"
        height="100%"
        onDocumentLoad={handleDocumentLoad}
        onError={handleError}
      />
    </div>
  );
};

export default TestPDFExample;