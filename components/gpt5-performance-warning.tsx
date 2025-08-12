"use client"

import { AlertTriangle, Clock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface GPT5PerformanceWarningProps {
  show: boolean
}

export default function GPT5PerformanceWarning({ show }: GPT5PerformanceWarningProps) {
  if (!show) return null

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="space-y-2">
        <div className="font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          GPT-5 Performance Notice
        </div>
        <div className="text-sm space-y-1">
          <p>
            <strong>Processing Time:</strong> GPT-5 may take up to 30 minutes to generate comprehensive research results due to its advanced reasoning capabilities.
          </p>
          <p>
            <strong>For faster results:</strong> Consider using GPT-4o (typically 5-10 minutes) if time is critical for your research needs.
          </p>
          <p className="text-amber-700">
            💡 <em>GPT-5's extended processing time enables deeper analytical insights and more thorough research.</em>
          </p>
        </div>
      </AlertDescription>
    </Alert>
  )
}