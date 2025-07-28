import React, { useState } from 'react'
import TestPDF from './testpdf'

const TestPDFExample: React.FC = () => {
  // Example props - you can modify these
  const [config, setConfig] = useState({
    pageNumber: 1,
    referenceText: "Trace-based Just-in-Time Type Specialization for Dynamic",
    fileUrl: "/compressed.tracemonkey-pldi-09.pdf"
  })

  const exampleConfigs = [
    {
      name: "First Page - Title",
      pageNumber: 1,
      referenceText: "Trace-based Just-in-Time Type Specialization for Dynamic",
      fileUrl: "/compressed.tracemonkey-pldi-09.pdf"
    },
    {
      name: "Page 2 - Abstract",
      pageNumber: 2,
      referenceText: "dynamic language implementations",
      fileUrl: "/compressed.tracemonkey-pldi-09.pdf"
    },
    {
      name: "Page 3 - Introduction",
      pageNumber: 3,
      referenceText: "just-in-time compilation",
      fileUrl: "/compressed.tracemonkey-pldi-09.pdf"
    },
    {
      name: "Custom Search",
      pageNumber: 1,
      referenceText: "Mozilla",
      fileUrl: "/compressed.tracemonkey-pldi-09.pdf"
    }
  ]

  const handleConfigChange = (newConfig: typeof config) => {
    setConfig(newConfig)
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Control Panel */}
      <div style={{ 
        width: '300px', 
        padding: '20px', 
        backgroundColor: '#f5f5f5',
        overflowY: 'auto',
        borderRight: '1px solid #ddd'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>TestPDF Component</h3>
        
        {/* Preset Examples */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#666', marginBottom: '10px' }}>📋 Preset Examples:</h4>
          {exampleConfigs.map((example, index) => (
            <button
              key={index}
              onClick={() => handleConfigChange(example)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                marginBottom: '8px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                textAlign: 'left'
              }}
            >
              {example.name}
            </button>
          ))}
        </div>

        {/* Custom Configuration */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#666', marginBottom: '10px' }}>⚙️ Custom Configuration:</h4>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              Page Number:
            </label>
            <input
              type="number"
              min="1"
              value={config.pageNumber}
              onChange={(e) => setConfig(prev => ({ ...prev, pageNumber: parseInt(e.target.value) || 1 }))}
              style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              Reference Text:
            </label>
            <textarea
              value={config.referenceText}
              onChange={(e) => setConfig(prev => ({ ...prev, referenceText: e.target.value }))}
              style={{ 
                width: '100%', 
                height: '80px', 
                padding: '6px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                resize: 'vertical'
              }}
              placeholder="Enter text to highlight..."
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              File URL:
            </label>
            <input
              type="text"
              value={config.fileUrl}
              onChange={(e) => setConfig(prev => ({ ...prev, fileUrl: e.target.value }))}
              style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
              placeholder="/path/to/your/pdf"
            />
          </div>
        </div>

        {/* Current Configuration Display */}
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#e9ecef', 
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <h5 style={{ margin: '0 0 8px 0', color: '#495057' }}>🔧 Current Configuration:</h5>
          <div><strong>Page:</strong> {config.pageNumber}</div>
          <div><strong>Text:</strong> {config.referenceText.substring(0, 30)}...</div>
          <div><strong>URL:</strong> {config.fileUrl}</div>
        </div>

        {/* Usage Code Example */}
        <div style={{ 
          marginTop: '20px',
          padding: '12px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px',
          fontSize: '11px',
          fontFamily: 'monospace'
        }}>
          <h5 style={{ margin: '0 0 8px 0', color: '#495057' }}>📝 Usage Code:</h5>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
{`<TestPDF
  pageNumber={${config.pageNumber}}
  referenceText="${config.referenceText.substring(0, 20)}..."
  fileUrl="${config.fileUrl}"
/>`}
          </pre>
        </div>
      </div>

      {/* PDF Viewer */}
      <div style={{ flex: 1 }}>
        <TestPDF
          pageNumber={config.pageNumber}
          referenceText={config.referenceText}
          fileUrl={config.fileUrl}
        />
      </div>
    </div>
  )
}

export default TestPDFExample 