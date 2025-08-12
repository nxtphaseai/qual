"use client"

import React from 'react'
import ReactMarkdown from 'react-markdown'

interface StreamingMarkdownProps {
  children: string
  isComplete: boolean
}

export default function StreamingMarkdown({ children, isComplete }: StreamingMarkdownProps) {
  // For incomplete (streaming) content, show raw text to avoid markdown parsing issues
  // Only parse markdown when the content is complete
  if (!isComplete || !children) {
    return (
      <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
        {children}
      </div>
    )
  }

  // When complete, render with full markdown support
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown 
        components={{
          // Custom components for better styling
          h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 text-gray-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-2 text-gray-900">{children}</h3>,
          p: ({ children }) => <p className="mb-2 text-gray-800 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-800">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
          code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">{children}</code>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}