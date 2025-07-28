import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { configurePDFWorker, WorkerSources } from './worker'

interface PDFContextValue {
  isWorkerReady: boolean
}

const PDFContext = createContext<PDFContextValue>({
  isWorkerReady: false
})

interface PDFProviderProps {
  children: ReactNode
  workerSrc?: string
}

export const PDFProvider: React.FC<PDFProviderProps> = ({ 
  children, 
  workerSrc = WorkerSources.UNPKG 
}) => {
  const [isWorkerReady, setIsWorkerReady] = React.useState(false)

  useEffect(() => {
    // Configure worker on mount
    try {
      configurePDFWorker(workerSrc, true) // Force configuration
      setIsWorkerReady(true)
    } catch (error) {
      console.error('Failed to configure PDF worker:', error)
    }
  }, [workerSrc])

  return (
    <PDFContext.Provider value={{ isWorkerReady }}>
      {children}
    </PDFContext.Provider>
  )
}

export const usePDFContext = () => {
  return useContext(PDFContext)
}

export default PDFContext 