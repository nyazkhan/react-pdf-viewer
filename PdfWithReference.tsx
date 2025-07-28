import React, { useState, useEffect } from 'react';
import { PDFViewer, configurePDFWorker } from '@nyazkhan/react-pdf-viewer';
import '@nyazkhan/react-pdf-viewer/styles/viewer.css';
import { Box } from '@mui/material';

import CardShimmerEffect from 'src/components/loading-screen/card-shimmer-effect';
import axiosInstance from 'src/utils/axios';

// Configure PDF.js worker before component usage
configurePDFWorker();

const PdfWithReference = ({ pdfData, fileUrl, referenceText = null, pageNumber = null }) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [pdfDocument, setPdfDocument] = useState(null);

  const handleError = (error) => {
    console.error('PDF Error:', error);
    setError('Failed to load PDF file. Please try again later.');
    setLoading(false);
  };

  const handleDocumentLoad = (pdf) => {
    console.log('PDF Document loaded successfully:', pdf);
    setPdfDocument(pdf);
    setLoading(false);
    console.log(`Loaded PDF with ${pdf.numPages} pages`);
    
    // If we have reference text, create highlights after document loads
    if (referenceText && pdf) {
      createHighlightsForText(referenceText, pdf);
    }
  };

  const createHighlightsForText = async (searchText, pdf) => {
    if (!pdf || !searchText.trim()) return;

    try {
      const newHighlights = [];
      
      // Search through all pages or specific page
      const startPage = pageNumber || 1;
      const endPage = pageNumber || pdf.numPages;
      
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Combine all text items into a single string with position tracking
        let fullText = '';
        const textItems = [];
        
        textContent.items.forEach((item) => {
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
          const startIndex = match.index;
          const endIndex = startIndex + match[0].length;
          
          // Find text items that contain this match
          const rects = [];
          
          for (const textItem of textItems) {
            // Check if this text item overlaps with our match
            if (textItem.endIndex > startIndex && textItem.startIndex < endIndex) {
              const [scaleX, skewY, skewX, scaleY, translateX, translateY] = textItem.transform;
              
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
            newHighlights.push({
              id: `highlight-${pageNum}-${startIndex}`,
              pageNumber: pageNum,
              rects: rects,
              color: '#ffff00',
              opacity: 0.4,
              content: match[0]
            });
          }
        }
      }
      
      console.log(`Created ${newHighlights.length} highlights for "${searchText}"`);
      setHighlights(newHighlights);
    } catch (error) {
      console.error('Error creating highlights:', error);
    }
  };

  useEffect(() => {
    const fetchPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Starting PDF fetch...', { fileUrl, pdfData: !!pdfData });

        // If fileUrl is provided, fetch from API
        if (fileUrl) {
          console.log('Fetching PDF from URL:', fileUrl);
          const response = await axiosInstance(fileUrl, {
            method: 'GET',
            credentials: 'include',
            responseType: 'arraybuffer',
            headers: {
              'Cache-Control': 'public, max-age=3600',
              Expires: new Date(Date.now() + 3600 * 1000).toUTCString(),
              Pragma: 'cache',
            },
          });

          if (!response.data) {
            throw new Error('No data received from server');
          }

          console.log('PDF data fetched successfully, size:', response.data.byteLength);
          
          // Convert to Blob URL for better compatibility
          const blob = new Blob([response.data], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          console.log('Created Blob URL:', blobUrl);
          setPdfUrl(blobUrl);
          
          return;
        }

        // Handle different types of PDF data input
        if (pdfData instanceof Blob) {
          console.log('Converting Blob to URL');
          const blobUrl = URL.createObjectURL(pdfData);
          setPdfUrl(blobUrl);
        } else if (typeof pdfData === 'string') {
          console.log('Using string PDF data');
          // If it's a base64 string
          if (pdfData.startsWith('data:application/pdf;base64,')) {
            setPdfUrl(pdfData);
          } else {
            // Assume it's a base64 string without the prefix
            setPdfUrl(`data:application/pdf;base64,${pdfData}`);
          }
        } else if (pdfData instanceof ArrayBuffer) {
          console.log('Converting ArrayBuffer to Blob URL');
          const blob = new Blob([pdfData], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          setPdfUrl(blobUrl);
        } else {
          throw new Error('No PDF data or fileUrl provided');
        }
      } catch (error) {
        console.error('Error in fetchPdf:', error);
        setError(`Failed to process PDF data: ${error.message}`);
        setLoading(false);
      }
    };

    if (fileUrl || pdfData) {
      fetchPdf();
    } else {
      console.log('No fileUrl or pdfData provided');
      setLoading(false);
    }
  }, [pdfData, fileUrl]);

  // Add a fallback timeout to prevent infinite loading
  useEffect(() => {
    if (pdfUrl && loading) {
      console.log('PDF URL set, starting timeout fallback');
      const timeout = setTimeout(() => {
        if (loading) {
          console.warn('PDF loading timeout - forcing loading to false');
          setError('PDF loading timeout. Please try again.');
          setLoading(false);
        }
      }, 15000); // 15 second timeout

      return () => clearTimeout(timeout);
    }
  }, [pdfUrl, loading]);

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  console.log('Render state:', { loading, error: !!error, pdfUrl: !!pdfUrl });

  if (loading) {
    return <CardShimmerEffect sx={{ height: '90vh' }} />;
  }

  if (error) {
    return (
      <Box 
        sx={{ 
          height: '90vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'error.main',
          fontSize: '1.1rem',
          textAlign: 'center',
          p: 3
        }}
      >
        {error}
      </Box>
    );
  }

  if (!pdfUrl) {
    return (
      <Box 
        sx={{ 
          height: '90vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'text.secondary',
          fontSize: '1.1rem',
          textAlign: 'center',
          p: 3
        }}
      >
        No PDF data available
      </Box>
    );
  }

  console.log('Rendering PDFViewer with:', { pdfUrl: typeof pdfUrl, page: pageNumber });

  return (
    <Box sx={{ height: '90vh', width: '100%' }}>
      <PDFViewer
        file={pdfUrl}
        width="100%"
        height="100%"
        page={pageNumber || 1}
        highlights={highlights}
        enableTextSelection={true}
        enableKeyboardShortcuts={true}
        renderToolbar={true}
        renderSidebar={false}
        showPageControls={true}
        showZoomControls={true}
        showSearchOption={true}
        showPrintOption={true}
        showDownloadOption={true}
        onDocumentLoad={(pdf) => {
          console.log('✅ PDFViewer onDocumentLoad called:', pdf);
          handleDocumentLoad(pdf);
        }}
        onError={(error) => {
          console.error('❌ PDFViewer onError called:', error);
          handleError(error);
        }}
        onPageChange={(page) => {
          console.log('📄 Page changed to:', page);
        }}
        onScaleChange={(scale) => {
          console.log('🔍 Scale changed to:', scale);
        }}
        onSearch={(term) => {
          console.log(`🔍 Searching for: ${term}`);
          if (term && pdfDocument) {
            createHighlightsForText(term, pdfDocument);
          }
        }}
      />
    </Box>
  );
};

export default PdfWithReference; 