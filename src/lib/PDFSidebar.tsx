import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { 
  PDFSidebarProps, 
  SidebarView, 
  PDFDocumentProxy, 
  PDFPageProxy,
  PDFOutlineItem 
} from './types'

export const PDFSidebar: React.FC<PDFSidebarProps> = ({
  isOpen,
  activeView,
  pdf,
  currentPage,
  outline,
  attachments,
  onToggle,
  onViewChange,
  onPageSelect,
  onOutlineClick,
  className = '',
  style,
}) => {
  const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({})
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<number>>(new Set())
  const [expandedOutlineItems, setExpandedOutlineItems] = useState<Set<string>>(new Set())
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null)
  const observer = useRef<IntersectionObserver | null>(null)

  // Load thumbnail for a specific page
  const loadThumbnail = useCallback(async (pageNum: number) => {
    if (!pdf || thumbnails[pageNum] || loadingThumbnails.has(pageNum)) return

    setLoadingThumbnails(prev => new Set(prev).add(pageNum))

    try {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 0.2 }) // Small scale for thumbnails
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }

      await page.render(renderContext).promise
      
      const thumbnailUrl = canvas.toDataURL()
      setThumbnails(prev => ({ ...prev, [pageNum]: thumbnailUrl }))
    } catch (error) {
      console.warn(`Failed to load thumbnail for page ${pageNum}:`, error)
    } finally {
      setLoadingThumbnails(prev => {
        const newSet = new Set(prev)
        newSet.delete(pageNum)
        return newSet
      })
    }
  }, [pdf, thumbnails, loadingThumbnails])

  // Setup intersection observer for lazy loading thumbnails
  useEffect(() => {
    if (activeView !== 'thumbnails' || !thumbnailsContainerRef.current) return

    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0')
            if (pageNum > 0) {
              loadThumbnail(pageNum)
            }
          }
        })
      },
      { rootMargin: '50px' }
    )

    const thumbnailElements = thumbnailsContainerRef.current.querySelectorAll('[data-page]')
    thumbnailElements.forEach(el => observer.current?.observe(el))

    return () => {
      if (observer.current) {
        observer.current.disconnect()
      }
    }
  }, [activeView, pdf, loadThumbnail])

  // Handle outline item toggle
  const handleOutlineToggle = useCallback((itemId: string) => {
    setExpandedOutlineItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  // Render outline items recursively
  const renderOutlineItems = useCallback((items: PDFOutlineItem[], level: number = 0): React.ReactNode => {
    return items.map((item, index) => {
      const itemId = `${level}-${index}`
      const hasChildren = item.items && item.items.length > 0
      const isExpanded = expandedOutlineItems.has(itemId)

      return (
        <div key={itemId} className="pdf-outline-item">
          <div 
            className="pdf-outline-item-content"
            style={{ 
              paddingLeft: `${level * 16 + 8}px`,
              display: 'flex',
              alignItems: 'center',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: item.bold ? 'bold' : 'normal',
              fontStyle: item.italic ? 'italic' : 'normal',
              color: item.color ? `rgb(${item.color.join(',')})` : 'inherit'
            }}
            onClick={() => {
              if (item.dest) {
                onOutlineClick(item.dest)
              }
              if (hasChildren) {
                handleOutlineToggle(itemId)
              }
            }}
          >
            {hasChildren && (
              <span 
                style={{ 
                  marginRight: '4px',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                ▶
              </span>
            )}
            <span>{item.title}</span>
          </div>
          {hasChildren && isExpanded && (
            <div className="pdf-outline-children">
              {renderOutlineItems(item.items!, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }, [expandedOutlineItems, handleOutlineToggle, onOutlineClick])

  if (!isOpen) return null

  const sidebarStyle: React.CSSProperties = {
    width: '250px',
    height: '100%',
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #dee2e6',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...style,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid #dee2e6',
    backgroundColor: '#e9ecef',
  }

  const tabStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
  }

  const activeTabStyle: React.CSSProperties = {
    ...tabStyle,
    backgroundColor: '#fff',
    borderBottom: '2px solid #007bff',
  }

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  }

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#6c757d',
    padding: '4px',
    borderRadius: '4px',
  }

  return (
    <div className={`pdf-sidebar ${className}`} style={sidebarStyle}>
      <button style={closeButtonStyle} onClick={onToggle} title="Close sidebar">
        ✕
      </button>
      
      {/* Sidebar tabs */}
      <div style={headerStyle}>
        <button
          style={activeView === 'thumbnails' ? activeTabStyle : tabStyle}
          onClick={() => onViewChange('thumbnails')}
          title="Show page thumbnails"
        >
          📄 Pages
        </button>
        <button
          style={activeView === 'outline' ? activeTabStyle : tabStyle}
          onClick={() => onViewChange('outline')}
          title="Show document outline"
        >
          📋 Outline
        </button>
        <button
          style={activeView === 'attachments' ? activeTabStyle : tabStyle}
          onClick={() => onViewChange('attachments')}
          title="Show attachments"
        >
          📎 Files
        </button>
        <button
          style={activeView === 'layers' ? activeTabStyle : tabStyle}
          onClick={() => onViewChange('layers')}
          title="Show layers"
        >
          🗂️ Layers
        </button>
      </div>

      {/* Sidebar content */}
      <div style={contentStyle}>
        {activeView === 'thumbnails' && (
          <div ref={thumbnailsContainerRef} className="pdf-thumbnails">
            {pdf && Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(pageNum => (
              <div
                key={pageNum}
                data-page={pageNum}
                className={`pdf-thumbnail ${pageNum === currentPage ? 'active' : ''}`}
                style={{
                  marginBottom: '8px',
                  padding: '8px',
                  border: pageNum === currentPage ? '2px solid #007bff' : '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: pageNum === currentPage ? '#e3f2fd' : 'white',
                  textAlign: 'center',
                }}
                onClick={() => onPageSelect(pageNum)}
              >
                <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>
                  Page {pageNum}
                </div>
                {thumbnails[pageNum] ? (
                  <img
                    src={thumbnails[pageNum]}
                    alt={`Page ${pageNum}`}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      border: '1px solid #dee2e6',
                    }}
                  />
                ) : loadingThumbnails.has(pageNum) ? (
                  <div style={{ 
                    height: '120px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6'
                  }}>
                    Loading...
                  </div>
                ) : (
                  <div style={{ 
                    height: '120px', 
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6'
                  }} />
                )}
              </div>
            ))}
          </div>
        )}

        {activeView === 'outline' && (
          <div className="pdf-outline">
            {outline && outline.length > 0 ? (
              renderOutlineItems(outline)
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#6c757d', 
                fontSize: '14px',
                padding: '20px'
              }}>
                No document outline available
              </div>
            )}
          </div>
        )}

        {activeView === 'attachments' && (
          <div className="pdf-attachments">
            {attachments && attachments.length > 0 ? (
              attachments.map((attachment, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onClick={() => {
                    // Download attachment
                    const blob = new Blob([attachment.content])
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = attachment.filename
                    link.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <span>📎</span>
                  <span style={{ fontSize: '14px' }}>{attachment.filename}</span>
                </div>
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#6c757d', 
                fontSize: '14px',
                padding: '20px'
              }}>
                No attachments found
              </div>
            )}
          </div>
        )}

        {activeView === 'layers' && (
          <div className="pdf-layers">
            <div style={{ 
              textAlign: 'center', 
              color: '#6c757d', 
              fontSize: '14px',
              padding: '20px'
            }}>
              Layers functionality coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PDFSidebar 