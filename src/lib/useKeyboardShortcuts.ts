import { useEffect, useCallback } from 'react'
import type { ToolbarTool, ViewMode } from './types'

export interface KeyboardShortcutsHandlers {
  onNextPage: () => void
  onPreviousPage: () => void
  onFirstPage: () => void
  onLastPage: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onActualSize: () => void
  onRotateClockwise: () => void
  onRotateCounterClockwise: () => void
  onPresentationMode: () => void
  onHandTool: () => void
  onTextSelection: () => void
  onFind: () => void
  onFindNext: () => void
  onFindPrevious: () => void
  onDownload: () => void
  onPrint: () => void
  onOpenFile: () => void
  onGoToPage: () => void
  onToggleSidebar: () => void
}

export const useKeyboardShortcuts = (
  enabled: boolean = true,
  handlers: Partial<KeyboardShortcutsHandlers> = {}
) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Don't handle shortcuts when typing in inputs
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    const { key, ctrlKey, metaKey, shiftKey, altKey } = event
    const modKey = ctrlKey || metaKey // Handle both Ctrl (PC) and Cmd (Mac)

    // Prevent browser default for our handled shortcuts
    let preventDefault = true

    switch (key.toLowerCase()) {
      // Navigation shortcuts
      case 'n':
      case 'j':
        if (!modKey) {
          handlers.onNextPage?.()
        } else {
          preventDefault = false
        }
        break

      case 'p':
      case 'k':
        if (!modKey) {
          handlers.onPreviousPage?.()
        } else if (modKey && altKey && key === 'p') {
          // Ctrl+Alt+P for presentation mode
          handlers.onPresentationMode?.()
        } else if (modKey && key === 'p') {
          // Ctrl+P for print
          handlers.onPrint?.()
        } else {
          preventDefault = false
        }
        break

      case 'home':
        handlers.onFirstPage?.()
        break

      case 'end':
        handlers.onLastPage?.()
        break

      case 'arrowleft':
        if (!modKey) {
          handlers.onPreviousPage?.()
        } else {
          preventDefault = false
        }
        break

      case 'arrowright':
        if (!modKey) {
          handlers.onNextPage?.()
        } else {
          preventDefault = false
        }
        break

      case 'arrowup':
      case 'pageup':
        handlers.onPreviousPage?.()
        break

      case 'arrowdown':
      case 'pagedown':
        handlers.onNextPage?.()
        break

      case ' ':
        // Space bar for next page (in presentation mode)
        if (!shiftKey) {
          handlers.onNextPage?.()
        } else {
          // Shift + Space for previous page
          handlers.onPreviousPage?.()
        }
        break

      case 'enter':
        // Enter for next page (in presentation mode)
        if (!shiftKey) {
          handlers.onNextPage?.()
        } else {
          // Shift + Enter for previous page
          handlers.onPreviousPage?.()
        }
        break

      // Zoom shortcuts
      case '+':
      case '=':
        if (modKey) {
          handlers.onZoomIn?.()
        } else {
          preventDefault = false
        }
        break

      case '-':
        if (modKey) {
          handlers.onZoomOut?.()
        } else {
          preventDefault = false
        }
        break

      case '0':
        if (modKey) {
          handlers.onActualSize?.()
        } else {
          preventDefault = false
        }
        break

      // Rotation shortcuts
      case 'r':
        if (!modKey && !shiftKey) {
          handlers.onRotateClockwise?.()
        } else if (!modKey && shiftKey) {
          handlers.onRotateCounterClockwise?.()
        } else {
          preventDefault = false
        }
        break

      // Tool shortcuts
      case 'h':
        if (!modKey) {
          handlers.onHandTool?.()
        } else {
          preventDefault = false
        }
        break

      case 's':
        if (!modKey) {
          handlers.onTextSelection?.()
        } else if (modKey) {
          // Ctrl+S for download
          handlers.onDownload?.()
        }
        break

      // Search shortcuts
      case 'f':
        if (modKey) {
          handlers.onFind?.()
        } else {
          preventDefault = false
        }
        break

      case 'g':
        if (modKey && !shiftKey) {
          handlers.onFindNext?.()
        } else if (modKey && shiftKey) {
          handlers.onFindPrevious?.()
        } else if (modKey && altKey) {
          // Ctrl+Alt+G for go to page
          handlers.onGoToPage?.()
        } else {
          preventDefault = false
        }
        break

      // File operations
      case 'o':
        if (modKey) {
          handlers.onOpenFile?.()
        } else {
          preventDefault = false
        }
        break

      // Note: 'p' case is handled above in navigation section for both
      // page navigation and print (Ctrl+P) and presentation (Ctrl+Alt+P)

      // Function keys
      case 'f4':
        handlers.onToggleSidebar?.()
        break

      default:
        preventDefault = false
        break
    }

    if (preventDefault) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, [enabled, handlers])

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])

  return null
}

export default useKeyboardShortcuts 