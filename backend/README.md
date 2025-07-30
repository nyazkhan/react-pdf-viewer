# PDF Highlighting Backend API

FastAPI service that extracts text coordinates from PDFs using PyMuPDF and returns normalized coordinates for frontend highlighting.

## Quick Start

```bash
cd backend
uv run main.py
```

The API will start on http://localhost:8000

## What it does

- Extracts text from PDFs using PyMuPDF
- Returns normalized coordinates (0-1 range) 
- Frontend handles viewport-specific scaling
- Supports both file upload and local file search

## Endpoints

- `POST /search` - Upload PDF and search text
- `POST /search-local` - Search in local PDF file  
- `GET /health` - Health check

## Dependencies

All dependencies are specified in the script header for UV compatibility:
- fastapi==0.104.1
- uvicorn[standard]==0.24.0
- python-multipart==0.0.6
- PyMuPDF==1.23.21
- pydantic==2.5.0
- rapidfuzz>=3.0.0