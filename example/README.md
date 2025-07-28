# React PDF Viewer - Example App

This is a comprehensive demo application showcasing the React PDF.js viewer component library.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Visit `http://localhost:3000` (or the port shown in the terminal)

## 📁 Project Structure

```
example/
├── src/
│   ├── App.tsx          # Main demo application
│   ├── main.tsx         # React entry point
│   └── viewer.css       # Imported styles
├── public/
│   ├── pdf.worker.min.js # PDF.js worker (local copy)
│   └── index.html       # HTML template
├── package.json
└── vite.config.ts       # Vite configuration
```

## 🔧 PDF.js Worker Configuration

The example app uses a local copy of the PDF.js worker to avoid CORS issues commonly encountered with CDN-hosted workers.

### Worker File Location
- **Local file:** `/public/pdf.worker.min.js`
- **Served at:** `http://localhost:3000/pdf.worker.min.js`

### Configuration in the Library
```typescript
// In src/lib/PDFViewer.tsx
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
```

### For Production Use

When deploying your application, ensure the worker file is accessible:

1. **Static hosting (Vercel, Netlify, etc.):**
   ```
   public/
   └── pdf.worker.min.js
   ```

2. **Custom server setup:**
   ```javascript
   // Express.js example
   app.use('/pdf.worker.min.js', express.static('path/to/pdf.worker.min.js'))
   ```

3. **CDN alternative (if CORS is properly configured):**
   ```typescript
   pdfjsLib.GlobalWorkerOptions.workerSrc = 
     `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
   ```

## ✨ Features Demonstrated

- **PDF Loading:** From URLs, file uploads, and sample documents
- **Navigation:** Page-by-page browsing with previous/next controls
- **Zoom Controls:** 25% to 400% zoom levels with smooth scaling
- **Text Selection:** Copy text directly from PDF pages
- **Responsive Design:** Mobile-friendly interface
- **Error Handling:** Graceful error handling and user feedback
- **Loading States:** Visual feedback during PDF loading

## 🔗 Sample PDF

The app loads a sample PDF from Mozilla's PDF.js repository by default:
`https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf`

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking

### Adding Custom Features

To extend the demo with custom features:

1. **Add new PDF sources:**
   ```typescript
   const customPDFs = [
     { name: 'Technical Paper', url: 'https://example.com/paper.pdf' },
     { name: 'User Manual', url: 'https://example.com/manual.pdf' }
   ]
   ```

2. **Implement custom highlights:**
   ```typescript
   const highlights: PDFHighlightType[] = [
     {
       id: 'custom-highlight',
       pageNumber: 1,
       rects: [{ left: 100, top: 200, width: 200, height: 20 }],
       color: '#ff6b6b',
       onClick: (highlight) => console.log('Custom action', highlight)
     }
   ]
   ```

3. **Custom toolbar actions:**
   ```typescript
   const customToolbar = (
     <div className="custom-toolbar">
       <button onClick={() => downloadPDF()}>Download</button>
       <button onClick={() => printPDF()}>Print</button>
     </div>
   )
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Worker loading errors:**
   - Ensure `pdf.worker.min.js` is in the `public/` directory
   - Check browser console for 404 errors
   - Verify the worker path in `pdfjsLib.GlobalWorkerOptions.workerSrc`

2. **CORS errors with remote PDFs:**
   - Use PDFs served with proper CORS headers
   - Test with local files or the provided sample PDF
   - Consider using a proxy for external PDFs

3. **Performance with large PDFs:**
   - Monitor memory usage in browser dev tools
   - Consider pagination for very large documents
   - Implement lazy loading for multi-page documents

### Debug Mode

Enable debug logging by setting:
```typescript
// In your component
onError={(error) => {
  console.error('PDF Error:', error)
  // Additional error handling
}}
```

## 📖 Learn More

- [React PDF.js Viewer Documentation](../README.md)
- [PDF.js Official Documentation](https://mozilla.github.io/pdf.js/)
- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/) 