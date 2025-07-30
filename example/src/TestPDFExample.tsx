import React, { useState, useCallback } from 'react';
import { PDFViewer, type PDFDocumentProxy, type PDFHighlightType, type PDFRect, type PDFPageViewport } from '../../dist/index.mjs';
import '../../dist/styles/viewer.css';
import { useHighlightAPI } from './highlightAPI';
import config from './config';

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
  const [currentViewport, setCurrentViewport] = useState<PDFPageViewport | null>(null);
  
  // API integration
  const { healthCheck, isLoading, error } = useHighlightAPI();
  const [apiAvailable, setApiAvailable] = useState(false);

  // Create highlights from text search - using PyMuPDF API
  const createHighlightsForText = useCallback(async (searchText: string, pdf: PDFDocumentProxy) => {
    if (!pdf || !searchText.trim()) {
      console.log('No PDF or search text provided');
      return;
    }

    if (!currentViewport) {
      console.warn('No viewport available for highlighting');
      return;
    }

    console.log('🔍 Starting text search for:', searchText.substring(0, 50) + '...');
    setDebugInfo('🔍 Searching for text...');
    
    let newHighlights: PDFHighlightType[] = [];
    
    try {
      if (config.enabled && apiAvailable) {
        // Use PyMuPDF API for superior highlighting
        // Note: TestPDF uses URLs, so we can't directly use the API which requires file upload
        // This demonstrates the fallback behavior
        
        // For URL-based files, we need to handle them differently
        // Since we can't directly pass URLs to our API, we'll use built-in for now
        // In a real implementation, you might want to download the PDF first
        if (fileUrl && fileUrl.startsWith('http')) {
          console.log('Using built-in highlighting for URL-based PDF (API requires file upload)');
          if (config.fallbackToBuiltIn) {
            // Fallback to manual extraction for URLs
            await createHighlightsManually(searchText, pdf, newHighlights);
          }
        } else {
          // For local files, we could use the API if we had the file path
          console.log('URL-based PDF detected, using built-in highlighting');
          await createHighlightsManually(searchText, pdf, newHighlights);
        }
      } else {
        // API disabled or unavailable, use built-in highlighting
        console.log('Using built-in highlighting (API disabled or unavailable)');
        await createHighlightsManually(searchText, pdf, newHighlights);
      }
      
      console.log(`🎯 Found ${newHighlights.length} highlights for "${searchText.substring(0, 30)}..."`);
      setHighlights(newHighlights);
      setDebugInfo(`✅ Found ${newHighlights.length} highlights using ${config.enabled && apiAvailable ? 'PyMuPDF API' : 'built-in'}`);
      
    } catch (error) {
      console.error('❌ Error creating highlights:', error);
      setDebugInfo('❌ Error during text search');
      
      // Fallback to manual highlighting on API error
      if (config.enabled && config.fallbackToBuiltIn) {
        try {
          console.log('Falling back to manual highlighting due to error');
          await createHighlightsManually(searchText, pdf, newHighlights);
          setHighlights(newHighlights);
          setDebugInfo(`✅ Found ${newHighlights.length} highlights using fallback`);
        } catch (fallbackError) {
          console.error('Manual highlighting also failed:', fallbackError);
        }
      }
    }
  }, [currentViewport, apiAvailable, fileUrl]);

  // Manual highlighting fallback (original logic)
  const createHighlightsManually = useCallback(async (searchText: string, pdf: PDFDocumentProxy, newHighlights: PDFHighlightType[]) => {
    // Search through all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`📄 Searching page ${pageNum}/${pdf.numPages}`);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
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
            const fontSize = Math.abs(scaleY);
            const left = translateX;
            const top = translateY;
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
  }, []);

  // Handle document load
  const handleDocumentLoad = useCallback(async (pdf: PDFDocumentProxy) => {
    console.log('📚 PDF Document loaded successfully:', {
      numPages: pdf.numPages,
      fingerprints: pdf.fingerprints,
    });
    
    setPdfDocument(pdf);
    setLoading(false);
    setError(null);
    setDebugInfo(`📚 PDF loaded: ${pdf.numPages} pages`);
    
    // Get initial viewport
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0, rotation: 0 });
      setCurrentViewport(viewport);
      console.log('Initial viewport set for TestPDF');
    } catch (error) {
      console.warn('Failed to get initial viewport for TestPDF:', error);
    }
    
    // Check API health
    if (config.enabled) {
      try {
        const isHealthy = await healthCheck();
        setApiAvailable(isHealthy);
        console.log(`API health check for TestPDF: ${isHealthy ? '✅ Available' : '❌ Unavailable'}`);
      } catch (error) {
        console.warn('API health check failed for TestPDF:', error);
        setApiAvailable(false);
      }
    }
    
    // Automatically create highlights for reference text
    if (referenceText && referenceText.trim()) {
      console.log('🎯 Auto-highlighting reference text...');
      createHighlightsForText(referenceText, pdf);
    }
  }, [referenceText, createHighlightsForText, healthCheck, pageNumber]);

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
        {config.enabled && (
          <div>🔬 API: {apiAvailable ? '✅ Available' : '❌ Unavailable'}</div>
        )}
        {isLoading && <div>⏳ Loading...</div>}
        {error && <div>❌ Error: {error}</div>}
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