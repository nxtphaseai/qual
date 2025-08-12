"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, ExternalLink } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface EntityModalProps {
  entity: string | null
  isOpen: boolean
  onClose: () => void
}

export default function EntityModal({ entity, isOpen, onClose }: EntityModalProps) {
  const [loading, setLoading] = useState(false)
  const [entityInfo, setEntityInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && entity && !entityInfo) {
      fetchEntityInfo(entity)
    }
  }, [isOpen, entity, entityInfo])

  const fetchEntityInfo = async (entityName: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/entity-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity: entityName }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch entity information')
      }

      const data = await response.json()
      setEntityInfo(data.info)
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching entity information')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setEntityInfo(null)
    setError(null)
    onClose()
  }

  if (!entity) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="min-w-[1280px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            {entity}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin mr-2 h-6 w-6" />
              <span>Loading information about {entity}...</span>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          {entityInfo && (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{entityInfo}</ReactMarkdown>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}