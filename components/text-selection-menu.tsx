"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"

interface TextSelectionMenuProps {
  onExplain: (selectedText: string) => void
}

export default function TextSelectionMenu({ onExplain }: TextSelectionMenuProps) {
  const [selectedText, setSelectedText] = useState<string>('')
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [isMenuVisible, setIsMenuVisible] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Small delay to let the selection settle
      timeoutRef.current = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim() || ''
        
        if (text && text.length > 0) {
          setSelectedText(text)
          
          // Get the selection bounds
          const range = selection?.getRangeAt(0)
          if (range) {
            const rect = range.getBoundingClientRect()
            // Position menu above the selection
            setMenuPosition({
              x: rect.left + (rect.width / 2),
              y: rect.top - 10
            })
            setIsMenuVisible(true)
          }
        }
      }, 10)
    }

    const handleMouseDown = (event: MouseEvent) => {
      // Only hide menu if clicking outside of it
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (isMenuVisible) {
          setIsMenuVisible(false)
          setSelectedText('')
          setMenuPosition(null)
          window.getSelection()?.removeAllRanges()
        }
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Hide menu on escape key
      if (event.key === 'Escape' && isMenuVisible) {
        setIsMenuVisible(false)
        setSelectedText('')
        setMenuPosition(null)
        window.getSelection()?.removeAllRanges()
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuVisible])

  const handleExplain = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('Explain clicked with text:', selectedText)
    
    if (selectedText) {
      onExplain(selectedText)
      // Clear selection and hide menu
      setIsMenuVisible(false)
      setSelectedText('')
      setMenuPosition(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  if (!isMenuVisible || !selectedText || !menuPosition) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={handleExplain}
        onMouseDown={(e) => e.preventDefault()} // Prevent default to avoid selection loss
        className="flex items-center gap-2 text-sm px-3 py-2 h-auto"
      >
        <MessageSquare className="h-4 w-4" />
        Explain
      </Button>
    </div>
  )
}