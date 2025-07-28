import React, { useState, useRef } from 'react'
import type { PDFToolbarProps, ToolbarTool, ViewMode, ZoomMode } from './types'

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  currentPage,
  totalPages,
  scale,
  viewMode = 'single',
  zoomMode = 'auto',
  activeTool = 'none',
  searchTerm = '',
  searchResults = 0,
  currentSearchResult = 0,
  sidebarOpen = false,
  onPageChange,
  onScaleChange,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onRotate,
  onOpenFile,
  onPrint,
  onDownload,
  onSearch,
  onSearchNext,
  onSearchPrevious,
  onClearSearch,
  onToolChange,
  onZoomToFit,
  onZoomToWidth,
  onViewModeChange,
  onZoomModeChange,
  onSidebarToggle,
  onPresentationMode,
  onDocumentInfo,
  className = '',
  style,
  showPageControls = true,
  showZoomControls = true,
  showRotateControls = true,
  showViewModeControls = true,
  showOpenOption = true,
  showSearchOption = true,
  showPrintOption = true,
  showDownloadOption = true,
  showToolSelection = true,
  showFitOptions = true,
  showPresentationMode = true,
}) => {
  const [pageInput, setPageInput] = useState(currentPage.toString())
  const [searchInput, setSearchInput] = useState(searchTerm)
  const [showSearchBar, setShowSearchBar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const pageNumber = parseInt(pageInput, 10)
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      onPageChange(pageNumber)
    } else {
      setPageInput(currentPage.toString())
    }
  }

  const handleScaleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newScale = parseFloat(e.target.value)
    onScaleChange(newScale)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch && searchInput.trim()) {
      onSearch(searchInput.trim())
    }
  }

  const handleOpenFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
    if (onOpenFile) {
      onOpenFile()
    }
  }

  const handleToolChange = (tool: ToolbarTool) => {
    if (onToolChange) {
      onToolChange(tool)
    }
  }

  const toggleSearchBar = () => {
    setShowSearchBar(!showSearchBar)
    if (!showSearchBar && onClearSearch) {
      onClearSearch()
      setSearchInput('')
    }
  }

  React.useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

  React.useEffect(() => {
    setSearchInput(searchTerm)
  }, [searchTerm])

  // Styles
  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: '#2c3e50',
    color: 'white',
    borderBottom: '1px solid #34495e',
    gap: '8px',
    flexWrap: 'wrap',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    ...style,
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#34495e',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    minWidth: '40px',
    justifyContent: 'center',
  }

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#3498db',
    color: 'white',
  }

  const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
    backgroundColor: '#34495e',
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px',
    border: '1px solid #495057',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#495057',
    color: 'white',
    textAlign: 'center',
    width: '60px',
  }

  const searchInputStyle: React.CSSProperties = {
    padding: '6px 12px',
    border: '1px solid #495057',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#495057',
    color: 'white',
    width: '200px',
  }

  const selectStyle: React.CSSProperties = {
    padding: '6px 8px',
    border: '1px solid #495057',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#495057',
    color: 'white',
    minWidth: '80px',
  }

  const separatorStyle: React.CSSProperties = {
    width: '1px',
    height: '32px',
    backgroundColor: '#495057',
    margin: '0 8px',
  }

  const toolGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#bdc3c7',
    fontWeight: '500',
  }

  return (
    <div className={`pdf-toolbar ${className}`} style={toolbarStyle}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          // File handling would be implemented in parent component
        }}
      />

      {/* Sidebar Toggle */}
      <div style={toolGroupStyle}>
        <button
          onClick={onSidebarToggle}
          style={sidebarOpen ? activeButtonStyle : buttonStyle}
          title="Toggle sidebar (F4)"
        >
          🗂️
        </button>
      </div>

      <div style={separatorStyle} />

      {/* File Operations Group */}
      {showOpenOption && (
        <div style={toolGroupStyle}>
          <button
            onClick={handleOpenFile}
            style={buttonStyle}
            title="Open PDF file (Ctrl+O)"
          >
            📁 Open
          </button>
        </div>
      )}

      {showOpenOption && <div style={separatorStyle} />}

      {/* Page Navigation Group */}
      {showPageControls && (
        <div style={toolGroupStyle}>
          <span style={labelStyle}>PAGE</span>
          <button
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            style={currentPage <= 1 ? disabledButtonStyle : buttonStyle}
            title="Previous page (←)"
          >
            ◀
          </button>
          
          <form onSubmit={handlePageInputSubmit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              style={inputStyle}
              title="Go to page"
            />
            <span style={{ fontSize: '14px', color: '#bdc3c7' }}>/ {totalPages}</span>
          </form>
          
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            style={currentPage >= totalPages ? disabledButtonStyle : buttonStyle}
            title="Next page (→)"
          >
            ▶
          </button>
        </div>
      )}

      {(showPageControls && showZoomControls) && <div style={separatorStyle} />}

      {/* Magnification/Zoom Group */}
      {showZoomControls && (
        <div style={toolGroupStyle}>
          <span style={labelStyle}>ZOOM</span>
          <button
            onClick={onZoomOut}
            style={buttonStyle}
            title="Zoom out (-)"
          >
            🔍−
          </button>
          
          <select
            value={scale}
            onChange={handleScaleSelect}
            style={selectStyle}
            title="Zoom level"
          >
            <option value={0.25}>25%</option>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1.0}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2.0}>200%</option>
            <option value={3.0}>300%</option>
            <option value={4.0}>400%</option>
          </select>
          
          <button
            onClick={onZoomIn}
            style={buttonStyle}
            title="Zoom in (+)"
          >
            🔍+
          </button>

          {showFitOptions && (
            <>
              <button
                onClick={onZoomToFit}
                style={zoomMode === 'page-fit' ? activeButtonStyle : buttonStyle}
                title="Fit to page"
              >
                📄 Fit
              </button>
              <button
                onClick={onZoomToWidth}
                style={zoomMode === 'page-width' ? activeButtonStyle : buttonStyle}
                title="Fit to width"
              >
                ↔ Width
              </button>
              <button
                onClick={() => onZoomModeChange?.('actual')}
                style={zoomMode === 'actual' ? activeButtonStyle : buttonStyle}
                title="Actual size"
              >
                🎯 Actual
              </button>
            </>
          )}
        </div>
      )}

      {/* View Mode Controls */}
      {showViewModeControls && (
        <>
          <div style={separatorStyle} />
          <div style={toolGroupStyle}>
            <span style={labelStyle}>VIEW</span>
            <button
              onClick={() => onViewModeChange?.('single')}
              style={viewMode === 'single' ? activeButtonStyle : buttonStyle}
              title="Single page view"
            >
              📄 Single
            </button>
            <button
              onClick={() => onViewModeChange?.('continuous')}
              style={viewMode === 'continuous' ? activeButtonStyle : buttonStyle}
              title="Continuous scroll view"
            >
              📜 Scroll
            </button>
            <button
              onClick={() => onViewModeChange?.('two-page')}
              style={viewMode === 'two-page' ? activeButtonStyle : buttonStyle}
              title="Two-page view"
            >
              📖 Two Page
            </button>
            <button
              onClick={() => onViewModeChange?.('book')}
              style={viewMode === 'book' ? activeButtonStyle : buttonStyle}
              title="Book view"
            >
              📚 Book
            </button>
          </div>
        </>
      )}

      {(showZoomControls && showToolSelection) && <div style={separatorStyle} />}

      {/* Tool Selection Group */}
      {showToolSelection && (
        <div style={toolGroupStyle}>
          <span style={labelStyle}>TOOLS</span>
          <button
            onClick={() => handleToolChange('pan')}
            style={activeTool === 'pan' ? activeButtonStyle : buttonStyle}
            title="Pan tool - Click and drag to move around"
          >
            ✋ Pan
          </button>
          
          <button
            onClick={() => handleToolChange('selection')}
            style={activeTool === 'selection' ? activeButtonStyle : buttonStyle}
            title="Selection tool - Select text and areas"
          >
            📄 Select
          </button>
          
          <button
            onClick={() => handleToolChange('annotation')}
            style={activeTool === 'annotation' ? activeButtonStyle : buttonStyle}
            title="Annotation tool - Add and edit annotations"
          >
            ✏️ Annotate
          </button>
        </div>
      )}

      {(showToolSelection && showSearchOption) && <div style={separatorStyle} />}

      {/* Search Group */}
      {showSearchOption && (
        <div style={toolGroupStyle}>
          <button
            onClick={toggleSearchBar}
            style={showSearchBar ? activeButtonStyle : buttonStyle}
            title="Search in document"
          >
            🔍 Search
          </button>
          
          {showSearchBar && (
            <>
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search in PDF..."
                  style={searchInputStyle}
                />
                <button
                  type="submit"
                  style={buttonStyle}
                  title="Search"
                >
                  🔍
                </button>
              </form>
              
              {searchResults > 0 && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#bdc3c7' }}>
                    {currentSearchResult + 1} of {searchResults}
                  </span>
                  <button
                    onClick={onSearchPrevious}
                    disabled={currentSearchResult <= 0}
                    style={currentSearchResult <= 0 ? disabledButtonStyle : buttonStyle}
                    title="Previous result"
                  >
                    ▲
                  </button>
                  <button
                    onClick={onSearchNext}
                    disabled={currentSearchResult >= searchResults - 1}
                    style={currentSearchResult >= searchResults - 1 ? disabledButtonStyle : buttonStyle}
                    title="Next result"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => {
                      if (onClearSearch) onClearSearch()
                      setSearchInput('')
                      setShowSearchBar(false)
                    }}
                    style={buttonStyle}
                    title="Clear search"
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {(showSearchOption && (showRotateControls || showPrintOption || showDownloadOption)) && (
        <div style={separatorStyle} />
      )}

      {/* Document Actions Group */}
      <div style={toolGroupStyle}>
        {showRotateControls && onRotate && (
          <button
            onClick={onRotate}
            style={buttonStyle}
            title="Rotate document clockwise (R)"
          >
            ↻ Rotate
          </button>
        )}

        {showPresentationMode && onPresentationMode && (
          <button
            onClick={onPresentationMode}
            style={buttonStyle}
            title="Presentation mode (Ctrl+Alt+P)"
          >
            🎦 Present
          </button>
        )}

        <button
          onClick={onDocumentInfo}
          style={buttonStyle}
          title="Document properties"
        >
          ℹ️ Info
        </button>

        {showPrintOption && onPrint && (
          <button
            onClick={onPrint}
            style={buttonStyle}
            title="Print document (Ctrl+P)"
          >
            🖨️ Print
          </button>
        )}

        {showDownloadOption && onDownload && (
          <button
            onClick={onDownload}
            style={buttonStyle}
            title="Download PDF (Ctrl+S)"
          >
            💾 Download
          </button>
        )}
      </div>
    </div>
  )
}

export default PDFToolbar 