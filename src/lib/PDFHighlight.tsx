import React from 'react'
import type { PDFHighlightProps, PDFHighlight as PDFHighlightType, PDFRect } from './types'

export const PDFHighlight: React.FC<PDFHighlightProps> = ({
  highlights,
  pageNumber,
  viewport,
  onHighlightClick,
  className = '',
  style,
}) => {
  const handleHighlightClick = (highlight: PDFHighlightType) => {
    if (onHighlightClick) {
      onHighlightClick(highlight)
    }
    if (highlight.onClick) {
      highlight.onClick(highlight)
    }
  }

  const renderHighlight = (highlight: PDFHighlightType) => {
    const { rects, color = '#ffff00', opacity = 0.3 } = highlight

    return rects.map((rect: PDFRect, index: number) => {
      // The rect coordinates are already converted to viewport pixels by the API layer
      // No additional scaling needed
      const canvasRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }

      // Debug logging
      console.log(`🎨 PDFHighlight rendering:`, {
        highlightId: highlight.id,
        rectIndex: index,
        original: rect,
        viewport: { width: viewport.width, height: viewport.height, scale: viewport.scale },
        finalPosition: canvasRect,
        pageNumber: highlight.pageNumber,
        currentPage: pageNumber
      })

      const highlightStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${canvasRect.left}px`,
        top: `${canvasRect.top}px`,
        width: `${canvasRect.width}px`,
        height: `${canvasRect.height}px`,
        backgroundColor: color,
        opacity,
        pointerEvents: 'auto',
        cursor: highlight.onClick || onHighlightClick ? 'pointer' : 'default',
        zIndex: 10,
        border: '2px solid red', // Debug border to make highlights visible
        boxSizing: 'border-box',
      }

      return (
        <div
          key={`${highlight.id}-${index}`}
          style={highlightStyle}
          onClick={() => handleHighlightClick(highlight)}
          title={highlight.content || `Highlight ${highlight.id}`}
          className="pdf-highlight-rect"
        />
      )
    })
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
    pointerEvents: 'none',
    ...style,
  }

  return (
    <div className={`pdf-highlights ${className}`} style={containerStyle}>
      {highlights
        .filter(highlight => highlight.pageNumber === pageNumber)
        .map(highlight => (
          <div key={highlight.id} className="pdf-highlight">
            {renderHighlight(highlight)}
          </div>
        ))}
    </div>
  )
}

export default PDFHighlight 