/**
 * Configuration for PyMuPDF Highlight API Integration
 */

// API Configuration
export const API_CONFIG = {
  // Base URL for the PyMuPDF API
  baseURL: (typeof window !== 'undefined' && (window as any).REACT_APP_HIGHLIGHT_API_URL) 
    ? (window as any).REACT_APP_HIGHLIGHT_API_URL 
    : 'http://localhost:8000',
  
  // Request timeout in milliseconds
  timeout: 10000,
  
  // Number of retry attempts for failed requests
  retries: 2,
  
  // Default search options
  defaultSearchOptions: {
    caseSensitive: false,
    fuzzyTolerance: 0.02, // 98% similarity
    color: '#ffff00',
    opacity: 0.3
  },
  
  // Enable/disable API integration
  enabled: true,
  
  // Fallback to built-in highlighting if API unavailable
  fallbackToBuiltIn: true,
  
  // Debug logging
  debug: true // Always enable debug for development
};

// Environment-specific configuration
export const getAPIConfig = () => {
  // For browser environment, we can't easily detect environment
  // Use development configuration by default
  return {
    ...API_CONFIG,
    baseURL: 'http://localhost:8000',
    debug: true
  };
};

// Export default configuration
export default getAPIConfig();