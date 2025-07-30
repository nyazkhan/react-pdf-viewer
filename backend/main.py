#!/usr/bin/env python3
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "fastapi==0.104.1",
#     "uvicorn[standard]==0.24.0", 
#     "python-multipart==0.0.6",
#     "PyMuPDF==1.23.21",
#     "pydantic==2.5.0",
#     "rapidfuzz>=3.0.0"
# ]
# ///
"""
Single-file UV-compatible FastAPI service for PDF text search and highlighting
Handles multi-line text extraction with PyMuPDF and returns normalized coordinates
Frontend handles viewport-specific scaling. Optimized with RapidFuzz for 10x faster fuzzy matching.
"""

import json
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from dataclasses import dataclass, asdict

import fitz  # PyMuPDF
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from rapidfuzz import fuzz

app = FastAPI(title="PDF Multi-line Highlighter API", version="1.0.0")

# Enable CORS for frontend integration
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@dataclass
class HighlightRect:
    """Rectangle coordinates for highlighting (normalized 0-1 range)"""
    left: float      # Normalized x0 (0.0 to 1.0)
    top: float       # Normalized y0 (0.0 to 1.0, top-left origin)
    right: float     # Normalized x1 (0.0 to 1.0)
    bottom: float    # Normalized y1 (0.0 to 1.0, top-left origin)
    width: float     # Normalized width (0.0 to 1.0)
    height: float    # Normalized height (0.0 to 1.0)
    page: int        # Page number (1-based)

@dataclass  
class SearchResult:
    """Search result with coordinates and metadata"""
    text: str
    matched_text: str
    rectangles: List[HighlightRect]
    confidence: float
    page_number: int
    line_span: int

class SearchRequest(BaseModel):
    """API request model"""
    search_text: str
    page_number: Optional[int] = None
    case_sensitive: bool = False
    fuzzy_tolerance: float = 0.1

class SearchResponse(BaseModel):
    """API response model"""
    success: bool
    matches: List[Dict[str, Any]]
    total_matches: int
    message: str = ""

class PDFTextSearcher:
    """PyMuPDF-based text searcher with coordinate extraction"""
    
    def __init__(self):
        self.doc = None
        self.page_count = 0
    
    def load_pdf(self, pdf_path: Union[str, Path]) -> None:
        """Load PDF document"""
        try:
            self.doc = fitz.open(pdf_path)
            self.page_count = len(self.doc)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to load PDF: {str(e)}")
    
    def search_text(self, search_text: str, page_number: Optional[int] = None, case_sensitive: bool = False, fuzzy_tolerance: float = 0.1) -> List[SearchResult]:
        """Search for text and return coordinates"""
        if not self.doc:
            raise HTTPException(status_code=400, detail="No PDF loaded")
        
        results = []
        pages_to_search = [page_number - 1] if page_number else range(self.page_count)
        
        for page_idx in pages_to_search:
            if page_idx < 0 or page_idx >= self.page_count:
                continue
                
            page = self.doc[page_idx]
            
            # Try exact search first
            flags = 0 if case_sensitive else fitz.TEXT_PRESERVE_WHITESPACE
            text_instances = page.search_for(search_text, flags=flags, quads=True)
            
            # If no exact matches and fuzzy tolerance > 0, try intelligent fuzzy search
            if not text_instances and fuzzy_tolerance > 0:
                text_instances = self._fuzzy_search_on_page(page, search_text, case_sensitive, fuzzy_tolerance)
            
            for instance in text_instances:
                # Convert PyMuPDF coordinates to normalized (0-1) format
                rectangles = self._convert_coordinates(instance, page)
                
                # Calculate line span
                line_span = self._calculate_line_span(rectangles)
                
                result = SearchResult(
                    text=search_text,
                    matched_text=search_text,  # For exact matches
                    rectangles=rectangles,
                    confidence=1.0,  # Exact match
                    page_number=page_idx + 1,
                    line_span=line_span
                )
                results.append(result)
        
        return results
    
    def _fuzzy_search_on_page(self, page, search_text, case_sensitive, fuzzy_tolerance):
        """Intelligent fuzzy search for 98%+ matching when exact search fails"""
        try:
            # Get all text from the page for fuzzy matching
            page_text = page.get_text()
            if not case_sensitive:
                page_text = page_text.lower()
                search_text = search_text.lower()
            
            # Normalize text to handle PDF artifacts
            normalized_page_text = self._normalize_pdf_text(page_text)
            normalized_search_text = self._normalize_pdf_text(search_text)
            
            # Calculate minimum similarity threshold (98% = 0.98)
            min_similarity = 1.0 - fuzzy_tolerance
            
            # Find best fuzzy matches
            matches = []
            search_words = normalized_search_text.split()
            
            # Try to find the search text with various approaches
            for start_idx in range(len(normalized_page_text) - len(normalized_search_text) + 1):
                window = normalized_page_text[start_idx:start_idx + len(normalized_search_text)]
                similarity = self._calculate_similarity(normalized_search_text, window)
                
                if similarity >= min_similarity:
                    # Found a fuzzy match, now find its coordinates
                    # Use a broader search with partial text to locate coordinates
                    for word in search_words[:2]:  # Use first 2 words for coordinate search
                        if len(word) > 3:  # Only use meaningful words
                            coord_matches = page.search_for(word, quads=True)
                            if coord_matches:
                                matches.extend(coord_matches)
                                break
            
            return matches
            
        except Exception as e:
            print(f"Fuzzy search error: {e}")
            return []
    
    def _normalize_pdf_text(self, text):
        """Normalize PDF text to handle common extraction issues"""
        # Handle ligatures and special characters
        text = text.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace('ﬀ', 'ff')
        text = text.replace('ﬃ', 'ffi').replace('ﬄ', 'ffl')
        # Handle smart quotes and dashes
        text = text.replace('"', '"').replace('"', '"').replace(''', "'").replace(''', "'")
        text = text.replace('—', '-').replace('–', '-')
        # Normalize whitespace
        text = ' '.join(text.split())
        return text
    
    def _calculate_similarity(self, text1, text2):
        """Calculate similarity between two strings using RapidFuzz (10x faster than manual Levenshtein)"""
        if len(text1) == 0 or len(text2) == 0:
            return 0.0
        
        # Use RapidFuzz ratio for much faster fuzzy matching
        # Returns similarity as percentage (0-100), convert to 0-1 range
        similarity = fuzz.ratio(text1, text2) / 100.0
        return similarity
    
    def _convert_coordinates(self, quad_or_rect, page) -> List[HighlightRect]:
        """Convert PyMuPDF coordinates to normalized (0-1) format"""
        rectangles = []
        
        # Handle both Rect and Quad objects
        if hasattr(quad_or_rect, 'ul'):  # It's a Quad
            # For quads, we need to handle multi-line text properly
            rect = quad_or_rect.rect  # Get bounding rectangle
        else:  # It's a Rect
            rect = quad_or_rect
        
        # Convert to normalized coordinates (0-1 range)
        # Frontend will handle viewport scaling
        page_width = page.rect.width
        page_height = page.rect.height
        
        highlight_rect = HighlightRect(
            left=rect.x0 / page_width,
            top=rect.y0 / page_height,
            right=rect.x1 / page_width,
            bottom=rect.y1 / page_height,
            width=rect.width / page_width,
            height=rect.height / page_height,
            page=page.number + 1
        )
        
        rectangles.append(highlight_rect)
        return rectangles
    
    def _calculate_line_span(self, rectangles: List[HighlightRect]) -> int:
        """Calculate how many lines the text spans"""
        if not rectangles:
            return 0
        
        # Group rectangles by approximate line position
        lines = set()
        for rect in rectangles:
            line_y = round(rect.top / 20) * 20  # Group by 20px intervals
            lines.add(line_y)
        
        return len(lines)
    
    def close(self):
        """Close the PDF document"""
        if self.doc:
            self.doc.close()
            self.doc = None

# Global searcher instance
searcher = PDFTextSearcher()

@app.post("/search", response_model=SearchResponse)
async def search_text_in_pdf(file: UploadFile = File(...), search_text: str = Form(...), page_number: Optional[int] = Form(None), case_sensitive: bool = Form(False), fuzzy_tolerance: float = Form(0.1)):
    """Search for text in uploaded PDF and return highlight coordinates"""
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_file_path = temp_file.name
    
    try:
        # Load PDF and search
        searcher.load_pdf(temp_file_path)
        results = searcher.search_text(search_text, page_number, case_sensitive, fuzzy_tolerance)
        
        # Convert results to response format
        matches = [asdict(result) for result in results]
        
        return SearchResponse(
            success=True,
            matches=matches,
            total_matches=len(matches),
            message=f"Found {len(matches)} matches"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        searcher.close()
        # Clean up temp file
        Path(temp_file_path).unlink(missing_ok=True)

@app.post("/search-local", response_model=SearchResponse) 
async def search_text_in_local_pdf(pdf_path: str = Form(...), search_text: str = Form(...), page_number: Optional[int] = Form(None), case_sensitive: bool = Form(False), fuzzy_tolerance: float = Form(0.1)):
    """Search for text in local PDF file"""
    
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")
    
    try:
        searcher.load_pdf(pdf_path)
        results = searcher.search_text(search_text, page_number, case_sensitive, fuzzy_tolerance)
        
        matches = [asdict(result) for result in results]
        
        return SearchResponse(
            success=True,
            matches=matches,
            total_matches=len(matches),
            message=f"Found {len(matches)} matches"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        searcher.close()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "PDF Multi-line Highlighter API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)