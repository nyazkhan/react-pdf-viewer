/**
 * React API Integration Service for PyMuPDF Multi-line Highlighter
 * 
 * Provides a React-friendly interface to call our PyMuPDF backend API
 * and convert responses to the format expected by the React PDF viewer.
 */

import React from 'react';
import type { PDFHighlightType, PDFRect } from '../../dist/index.mjs';
import { PDFPageViewport } from '../../dist/index.mjs';
import config from './config';

// API Response Types
interface APIHighlightRect {
  left: number;      // normalized 0-1
  top: number;       // normalized 0-1
  right: number;     // normalized 0-1  
  bottom: number;    // normalized 0-1
  width: number;     // normalized 0-1
  height: number;    // normalized 0-1
  page: number;      // 1-based page number
}

interface APISearchResult {
  text: string;
  matched_text: string;
  rectangles: APIHighlightRect[];
  confidence: number;
  page_number: number;
  line_span: number;
}

interface APIResponse {
  success: boolean;
  matches: APISearchResult[];
  total_matches: number;
  message: string;
}

// Service Configuration
interface HighlightAPIConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
}

interface SearchOptions {
  pageNumber?: number;
  caseSensitive?: boolean;
  fuzzyTolerance?: number;
  color?: string;
  opacity?: number;
}

interface ViewportInfo {
  width: number;
  height: number;
  scale: number;
  rotation?: number;
}

// Main API Service Class
export class HighlightAPIService {
  private config: Required<HighlightAPIConfig>;

  constructor(apiConfig: HighlightAPIConfig = {}) {
    this.config = {
      baseURL: apiConfig.baseURL || config.baseURL,
      timeout: apiConfig.timeout || config.timeout,
      retries: apiConfig.retries || config.retries
    };
  }

  /**
   * Search for text in PDF using PyMuPDF API and return React-compatible highlights
   */
  async searchAndHighlight(
    file: File,
    searchText: string,
    viewport: ViewportInfo,
    options: SearchOptions = {}
  ): Promise<PDFHighlightType[]> {
    try {
      // Prepare form data for API call
      const formData = new FormData();
      formData.append('file', file);
      formData.append('search_text', searchText);
      
      // Add search options
      if (options.pageNumber) {
        formData.append('page_number', options.pageNumber.toString());
      }
      formData.append('case_sensitive', (options.caseSensitive ?? config.defaultSearchOptions.caseSensitive).toString());
      formData.append('fuzzy_tolerance', (options.fuzzyTolerance ?? config.defaultSearchOptions.fuzzyTolerance).toString());
      
      // Note: Backend now uses percentage-only coordinates
      // Viewport scaling will be handled client-side

      // Call API with retry logic
      const response = await this.callAPIWithRetry('/search', formData);
      
      if (!response.success) {
        throw new Error(response.message || 'Search failed');
      }

      // Convert API response to React highlight format
      return this.convertToReactHighlights(response.matches, viewport, options);

    } catch (error) {
      console.error('Highlight API error:', error);
      throw new Error(`Failed to search and highlight: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for text in local PDF file (for development/testing)
   */
  async searchLocalPDF(
    pdfPath: string,
    searchText: string,
    viewport: ViewportInfo,
    options: SearchOptions = {}
  ): Promise<PDFHighlightType[]> {
    try {
      const formData = new FormData();
      formData.append('pdf_path', pdfPath);
      formData.append('search_text', searchText);
      
      if (options.pageNumber) {
        formData.append('page_number', options.pageNumber.toString());
      }
      formData.append('case_sensitive', (options.caseSensitive ?? config.defaultSearchOptions.caseSensitive).toString());
      formData.append('fuzzy_tolerance', (options.fuzzyTolerance ?? config.defaultSearchOptions.fuzzyTolerance).toString());
      
      // Note: Backend now uses percentage-only coordinates
      // Viewport scaling will be handled client-side

      const response = await this.callAPIWithRetry('/search-local', formData);
      
      if (!response.success) {
        throw new Error(response.message || 'Local search failed');
      }

      return this.convertToReactHighlights(response.matches, viewport, options);

    } catch (error) {
      console.error('Local highlight API error:', error);
      throw new Error(`Failed to search local PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert API response to React PDF viewer highlight format
   */
  private convertToReactHighlights(
    matches: APISearchResult[],
    viewport: ViewportInfo,
    options: SearchOptions
  ): PDFHighlightType[] {
    const highlights: PDFHighlightType[] = [];

    if (config.debug) {
      console.log('🔍 Converting API highlights to React format:', {
        matchesCount: matches.length,
        viewport: { width: viewport.width, height: viewport.height, scale: viewport.scale }
      });
    }

    matches.forEach((match, matchIndex) => {
      // Convert each API rectangle to React PDF format
      const rects: PDFRect[] = match.rectangles.map((apiRect, rectIndex) => {
        // API returns normalized coordinates (0-1) from PyMuPDF
        // Convert to PDF.js viewport coordinates by scaling with current viewport
        const rect: PDFRect = {
          left: apiRect.left * viewport.width,
          top: apiRect.top * viewport.height,
          width: apiRect.width * viewport.width,
          height: apiRect.height * viewport.height
        };

        if (config.debug) {
          console.log(`📐 Highlight ${matchIndex}-${rectIndex} coordinate conversion:`, {
            apiRect: apiRect,
            viewportRect: rect,
            page: match.page_number
          });
        }

        return rect;
      });

      // Create React highlight object
      const highlight: PDFHighlightType = {
        id: `api-highlight-${match.page_number}-${matchIndex}`,
        pageNumber: match.page_number,
        rects: rects,
        color: options.color || config.defaultSearchOptions.color,
        opacity: options.opacity || config.defaultSearchOptions.opacity,
        content: match.matched_text
      };

      if (config.debug) {
        console.log(`✅ Created highlight:`, {
          id: highlight.id,
          pageNumber: highlight.pageNumber,
          rectsCount: highlight.rects.length,
          content: highlight.content?.substring(0, 50) + '...'
        });
      }

      highlights.push(highlight);
    });

    return highlights;
  }

  /**
   * Call API with retry logic and proper error handling
   */
  private async callAPIWithRetry(endpoint: string, formData: FormData): Promise<APIResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(`${this.config.baseURL}${endpoint}`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: APIResponse = await response.json();
        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.retries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          console.warn(`API call attempt ${attempt + 1} failed, retrying...`, lastError.message);
        }
      }
    }

    throw lastError || new Error('All API call attempts failed');
  }

  /**
   * Check if API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseURL}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;

    } catch (error) {
      console.warn('API health check failed:', error);
      return false;
    }
  }

  /**
   * Update API configuration
   */
  updateConfig(newConfig: Partial<HighlightAPIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Default service instance
export const highlightAPI = new HighlightAPIService();

// React Hook for API usage
export interface UseHighlightAPIResult {
  searchAndHighlight: (file: File, searchText: string, viewport: ViewportInfo, options?: SearchOptions) => Promise<PDFHighlightType[]>;
  searchLocalPDF: (pdfPath: string, searchText: string, viewport: ViewportInfo, options?: SearchOptions) => Promise<PDFHighlightType[]>;
  healthCheck: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook for highlight API integration
 */
export function useHighlightAPI(): UseHighlightAPIResult {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const wrapAPICall = <T extends unknown[], R>(
    apiCall: (...args: T) => Promise<R>
  ) => {
    return async (...args: T): Promise<R> => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await apiCall(...args);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    };
  };

  return {
    searchAndHighlight: wrapAPICall(highlightAPI.searchAndHighlight.bind(highlightAPI)),
    searchLocalPDF: wrapAPICall(highlightAPI.searchLocalPDF.bind(highlightAPI)),
    healthCheck: wrapAPICall(highlightAPI.healthCheck.bind(highlightAPI)),
    isLoading,
    error
  };
}

// Helper function to get viewport info from PDF.js viewport
export function getViewportInfo(viewport: PDFPageViewport): ViewportInfo {
  return {
    width: viewport.width,
    height: viewport.height,
    scale: viewport.scale,
    rotation: viewport.rotation
  };
}

// Export types for external use
export type { SearchOptions, ViewportInfo, HighlightAPIConfig };