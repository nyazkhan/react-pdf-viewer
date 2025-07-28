# React PDF.js Viewer

[![npm version](https://img.shields.io/npm/v/@nyazkhan/react-pdf-viewer.svg)](https://www.npmjs.com/package/@nyazkhan/react-pdf-viewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

A comprehensive **React TypeScript component library** for viewing and interacting with PDF files using **Mozilla PDF.js**. Features complete PDF.js web viewer functionality with modern React patterns, full TypeScript support, and enhanced user experience.

## ✨ Features

### 🔥 **Complete PDF.js Web Viewer Functionality**
- 📄 **PDF Rendering**: High-quality PDF rendering with Mozilla PDF.js
- 🖍️ **Text Highlighting**: Search and highlight text across all pages
- 🔍 **Text Selection**: Smooth text selection that works perfectly at any zoom level
- 🔎 **Search**: Find text with result navigation and highlighting
- 🗂️ **Sidebar**: Thumbnails, outline, attachments, and layers
- 👁️ **View Modes**: Single page, continuous, two-page, and book views
- 🔍 **Zoom Controls**: Fit to page, fit to width, actual size, custom zoom
- 🛠️ **Tools**: Hand/pan, text selection, annotation tools
- ⌨️ **Keyboard Shortcuts**: All official PDF.js keyboard shortcuts
- 🎦 **Presentation Mode**: Full-screen document viewing
- 🖨️ **Print & Download**: Complete document export functionality
- 📱 **Responsive Design**: Mobile-friendly and responsive layout
- 🎨 **Customizable**: Extensive theming and styling options

### 🚀 **Enhanced React Integration**
- ⚡ **TypeScript First**: Full type safety and IntelliSense support
- 🎣 **React Hooks**: Modern React patterns with hooks and context
- 🔄 **State Management**: Comprehensive state management for all viewer features
- 🛡️ **Error Handling**: Robust error boundaries and fallback mechanisms
- 🏗️ **Component Architecture**: Modular, reusable component design
- 📦 **Tree Shakeable**: Import only the components you need

## 🚀 Installation

```bash
npm install @nyazkhan/react-pdf-viewer pdfjs-dist
```

```bash
yarn add @nyazkhan/react-pdf-viewer pdfjs-dist
```

```bash
pnpm add @nyazkhan/react-pdf-viewer pdfjs-dist
```

## 📖 Quick Start

### Basic Usage

```tsx
import React from 'react'
import { PDFViewer } from '@nyazkhan/react-pdf-viewer'
import '@nyazkhan/react-pdf-viewer/styles/viewer.css'

function App() {
  return (
    <div style={{ height: '100vh' }}>
      <PDFViewer
        file="/path/to/your/document.pdf"
        width="100%"
        height="100%"
      />
    </div>
  )
}

export default App
```

### Advanced Usage with All Features

```tsx
import React, { useState } from 'react'
import {
  PDFViewer,
  type PDFDocumentProxy,
  type PDFHighlightType,
  type ViewMode,
  type SidebarView
} from '@nyazkhan/react-pdf-viewer'
import '@nyazkhan/react-pdf-viewer/styles/viewer.css'

function AdvancedPDFViewer() {
  const [highlights, setHighlights] = useState<PDFHighlightType[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [sidebarView, setSidebarView] = useState<SidebarView>('thumbnails')

  const handleDocumentLoad = (pdf: PDFDocumentProxy) => {
    console.log(`Loaded PDF with ${pdf.numPages} pages`)
  }

  const handleSearch = (term: string) => {
    console.log(`Searching for: ${term}`)
  }

  return (
    <PDFViewer
      file="/sample.pdf"
      highlights={highlights}
      viewMode={viewMode}
      sidebarView={sidebarView}
      enableTextSelection={true}
      enableKeyboardShortcuts={true}
      onDocumentLoad={handleDocumentLoad}
      onViewModeChange={setViewMode}
      onSidebarViewChange={setSidebarView}
      onSearch={handleSearch}
      width="100%"
      height="100vh"
      showPageControls={true}
      showZoomControls={true}
      showSearchOption={true}
      showPrintOption={true}
      showDownloadOption={true}
    />
  )
}
```

### Text Highlighting

```tsx
import React, { useState, useCallback } from 'react'
import { PDFViewer, type PDFHighlightType, type PDFDocumentProxy } from '@nyazkhan/react-pdf-viewer'

function PDFWithHighlighting() {
  const [highlights, setHighlights] = useState<PDFHighlightType[]>([])
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)

  const createHighlight = useCallback(async (searchText: string) => {
    if (!pdfDocument) return

    const newHighlights: PDFHighlightType[] = []
    
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Your highlighting logic here
      // ... (implementation details)
    }
    
    setHighlights(newHighlights)
  }, [pdfDocument])

  return (
    <div>
      <input
        type="text"
        placeholder="Enter text to highlight"
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            createHighlight(e.currentTarget.value)
          }
        }}
      />
      <PDFViewer
        file="/document.pdf"
        highlights={highlights}
        onDocumentLoad={setPdfDocument}
        width="100%"
        height="600px"
      />
    </div>
  )
}
```

## 🎛️ API Reference

### PDFViewer Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `file` | `string \| File \| ArrayBuffer \| Uint8Array` | - | **Required.** PDF file to display |
| `width` | `string \| number` | `"100%"` | Viewer width |
| `height` | `string \| number` | `"600px"` | Viewer height |
| `page` | `number` | `1` | Initial page number |
| `scale` | `number` | `1.0` | Initial zoom scale |
| `rotation` | `number` | `0` | Initial rotation (0, 90, 180, 270) |
| `viewMode` | `ViewMode` | `"single"` | Page view mode |
| `sidebarView` | `SidebarView` | `"none"` | Sidebar view type |
| `highlights` | `PDFHighlightType[]` | `[]` | Text highlights to display |
| `enableTextSelection` | `boolean` | `true` | Enable text selection |
| `enableKeyboardShortcuts` | `boolean` | `true` | Enable keyboard shortcuts |
| `renderToolbar` | `boolean` | `true` | Show toolbar |
| `renderSidebar` | `boolean` | `true` | Show sidebar |

### Event Handlers

| Prop | Type | Description |
|------|------|-------------|
| `onDocumentLoad` | `(pdf: PDFDocumentProxy) => void` | Called when PDF loads |
| `onPageChange` | `(page: number) => void` | Called when page changes |
| `onScaleChange` | `(scale: number) => void` | Called when zoom changes |
| `onViewModeChange` | `(mode: ViewMode) => void` | Called when view mode changes |
| `onSearch` | `(term: string) => void` | Called when searching |
| `onError` | `(error: Error) => void` | Called on errors |

### Types

```tsx
type ViewMode = 'single' | 'continuous' | 'two-page' | 'book'
type SidebarView = 'none' | 'thumbnails' | 'outline' | 'attachments' | 'layers'
type ToolbarTool = 'none' | 'hand' | 'selection' | 'annotation'

interface PDFHighlightType {
  id: string
  pageNumber: number
  rects: PDFRect[]
  color?: string
  opacity?: number
  content?: string
}

interface PDFRect {
  left: number
  top: number
  width: number
  height: number
}
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `n`, `j`, `Space` | Next page |
| `p`, `k`, `Shift+Space` | Previous page |
| `Ctrl/Cmd + +` | Zoom in |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + 0` | Actual size |
| `Ctrl/Cmd + F` | Find/Search |
| `Ctrl/Cmd + G` | Find next |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + S` | Save/Download |
| `Ctrl/Cmd + P` | Print |
| `F4` | Toggle sidebar |
| `Home` | First page |
| `End` | Last page |
| `r` | Rotate clockwise |
| `Shift + r` | Rotate counter-clockwise |

## 🎨 Styling

Import the default styles:

```css
@import '@nyazkhan/react-pdf-viewer/styles/viewer.css';
```

Or customize with CSS variables:

```css
.pdf-viewer {
  --pdf-toolbar-bg: #2c3e50;
  --pdf-toolbar-color: white;
  --pdf-sidebar-bg: #34495e;
  --pdf-page-border: #ddd;
  --pdf-highlight-color: #ffff00;
  --pdf-selection-color: #3498db;
}
```

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## 🔧 Requirements

- **React**: 16.8.0 or higher
- **pdfjs-dist**: 3.0.0 or higher
- **Modern browser** with ES2017 support

## 📝 License

MIT © [Nyaz Khan](https://github.com/nyazkhan)

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 🐛 Issues

Found a bug? Please [open an issue](https://github.com/nyazkhan/react-pdf-viewer/issues) with a detailed description.

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=nyazkhan/react-pdf-viewer&type=Date)](https://star-history.com/#nyazkhan/react-pdf-viewer&Date)

---

**Made with ❤️ for the React community** 