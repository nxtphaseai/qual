"use client"

import { useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx'

type RecordItem = {
  id: string
  text: string
  meta?: Record<string, any>
  businessData?: {
    type: 'financial' | 'sales' | 'operational' | 'general'
    metrics?: string[]
    timeRange?: string
    summary?: string
  }
}

export default function FileDrop({ onParsed }: { onParsed: (items: RecordItem[]) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Business metrics detection patterns
  const BUSINESS_METRICS = {
    financial: ['revenue', 'income', 'profit', 'loss', 'margin', 'ebitda', 'cash', 'debt', 'assets', 'liabilities', 'equity'],
    sales: ['sales', 'units', 'orders', 'customers', 'leads', 'conversion', 'pipeline', 'deals', 'quota'],
    operational: ['inventory', 'stock', 'production', 'capacity', 'efficiency', 'headcount', 'employees', 'costs']
  }

  const detectBusinessDataType = (headers: string[]): 'financial' | 'sales' | 'operational' | 'general' => {
    const lowerHeaders = headers.map(h => h.toLowerCase())
    
    const financialScore = BUSINESS_METRICS.financial.reduce((score, term) => 
      score + lowerHeaders.filter(h => h.includes(term)).length, 0)
    const salesScore = BUSINESS_METRICS.sales.reduce((score, term) => 
      score + lowerHeaders.filter(h => h.includes(term)).length, 0)
    const operationalScore = BUSINESS_METRICS.operational.reduce((score, term) => 
      score + lowerHeaders.filter(h => h.includes(term)).length, 0)
    
    if (financialScore > salesScore && financialScore > operationalScore) return 'financial'
    if (salesScore > operationalScore) return 'sales'
    if (operationalScore > 0) return 'operational'
    return 'general'
  }

  const detectTimeRange = (data: any[]): string | undefined => {
    // Look for date columns
    const dateHeaders = ['date', 'period', 'month', 'year', 'quarter', 'time']
    const firstRow = data[0] || {}
    
    for (const [key, value] of Object.entries(firstRow)) {
      if (dateHeaders.some(h => key.toLowerCase().includes(h))) {
        // Extract time range from data
        const values = data.map(row => row[key]).filter(Boolean)
        if (values.length > 1) {
          return `${values[0]} to ${values[values.length - 1]}`
        }
      }
    }
    return undefined
  }

  const parseTextFile = async (file: File): Promise<RecordItem[]> => {
    const text = await file.text().then(t => t.trim())
    if (!text) return []
    
    // For context analysis, treat the entire file as one record
    // Only split into multiple records if the file is very large (>50KB) or has clear document boundaries
    if (text.length > 50000 || text.includes('---DOCUMENT---') || text.includes('===')) {
      const parts = text
        .split(/\n\s*\n/g)
        .map((t, i) => ({ id: `${file.name}-section-${i + 1}`, text: t.trim() }))
        .filter((r) => r.text)
      return parts
    }
    
    // Default: treat as single document
    return [{ id: file.name, text }]
  }

  const parseExcel = async (file: File): Promise<RecordItem[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const results: RecordItem[] = []
          
          workbook.SheetNames.forEach((sheetName, sheetIndex) => {
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
            
            if (jsonData.length > 1) {
              const headers = (jsonData[0] as string[]) || []
              const rows = jsonData.slice(1) as any[][]
              
              const businessDataType = detectBusinessDataType(headers)
              const timeRange = detectTimeRange(rows.map(row => 
                Object.fromEntries(headers.map((h, i) => [h, row[i]]))
              ))
              
              // Create summary of the data
              const summary = `Excel sheet "${sheetName}" contains ${rows.length} rows of ${businessDataType} data with columns: ${headers.join(', ')}`
              
              const detectedMetrics = headers.filter(h => 
                Object.values(BUSINESS_METRICS).flat().some(metric => 
                  h.toLowerCase().includes(metric)
                )
              )
              
              results.push({
                id: `${file.name}-${sheetName}`,
                text: summary,
                meta: {
                  sheetName,
                  headers,
                  rowCount: rows.length,
                  data: rows.slice(0, 10) // First 10 rows as sample
                },
                businessData: {
                  type: businessDataType,
                  metrics: detectedMetrics,
                  timeRange,
                  summary
                }
              })
            }
          })
          
          resolve(results)
        } catch (error) {
          console.error('Excel parsing error:', error)
          resolve([])
        }
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const parseCsv = async (file: File): Promise<RecordItem[]> => {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return []
    
    // Enhanced CSV parsing with better quote handling
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim())
    const rows = lines.slice(1).map(parseCSVLine)
    
    const businessDataType = detectBusinessDataType(headers)
    const dataObjects = rows.map(row => 
      Object.fromEntries(headers.map((h, i) => [h, row[i]?.replace(/"/g, '').trim() || '']))
    )
    const timeRange = detectTimeRange(dataObjects)
    
    const detectedMetrics = headers.filter(h => 
      Object.values(BUSINESS_METRICS).flat().some(metric => 
        h.toLowerCase().includes(metric)
      )
    )
    
    // Try to find a text-like column first
    const textIdx = headers.findIndex((h) => ["text", "message", "comment", "content", "body", "note"].some(term => h.toLowerCase().includes(term)))
    
    if (textIdx >= 0) {
      return rows
        .map((cols, i) => ({
          id: `${file.name}-${i + 1}`,
          text: (cols[textIdx] || "").replace(/"/g, '').trim(),
          meta: Object.fromEntries(headers.map((h, j) => [h, cols[j]?.replace(/"/g, '').trim() || ""])),
          businessData: {
            type: businessDataType,
            metrics: detectedMetrics,
            timeRange,
            summary: `CSV file with ${rows.length} rows of ${businessDataType} data`
          }
        }))
        .filter((r) => r.text)
    }
    
    // For business data files, create a summary instead of joining all columns
    if (businessDataType !== 'general') {
      const summary = `CSV file "${file.name}" contains ${rows.length} rows of ${businessDataType} data with columns: ${headers.join(', ')}`
      
      return [{
        id: `${file.name}-summary`,
        text: summary,
        meta: {
          headers,
          rowCount: rows.length,
          data: dataObjects.slice(0, 10) // First 10 rows as sample
        },
        businessData: {
          type: businessDataType,
          metrics: detectedMetrics,
          timeRange,
          summary
        }
      }]
    }
    
    // Fallback: join the row for general data
    return rows
      .map((cols, i) => ({
        id: `${file.name}-${i + 1}`,
        text: cols.join(" ").replace(/"/g, '').trim(),
      }))
      .filter((r) => r.text)
  }

  const parseJson = async (file: File): Promise<RecordItem[]> => {
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      // Support array of objects or single object with array
      const arr = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : []
      if (Array.isArray(arr)) {
        // choose the longest string field as text
        const items: RecordItem[] = []
        for (let i = 0; i < arr.length; i++) {
          const row = arr[i]
          if (row && typeof row === "object") {
            let bestKey = ""
            let bestVal = ""
            for (const [k, v] of Object.entries(row)) {
              if (typeof v === "string" && v.trim().length > bestVal.length) {
                bestKey = k
                bestVal = v.trim()
              }
            }
            if (bestVal) {
              items.push({ id: `${file.name}-${i + 1}`, text: bestVal, meta: row })
            }
          } else if (typeof row === "string") {
            items.push({ id: `${file.name}-${i + 1}`, text: row })
          }
        }
        return items
      }
      // Single object fallback
      return [{ id: `${file.name}-1`, text: JSON.stringify(data) }]
    } catch {
      return []
    }
  }

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      const all: RecordItem[] = []
      for (const f of Array.from(files)) {
        const ext = f.name.toLowerCase().split(".").pop()
        if (ext === "txt" || ext === "md") {
          all.push(...(await parseTextFile(f)))
        } else if (ext === "csv") {
          all.push(...(await parseCsv(f)))
        } else if (ext === "json") {
          all.push(...(await parseJson(f)))
        } else if (ext === "xlsx" || ext === "xls") {
          all.push(...(await parseExcel(f)))
        } else {
          // unsupported; skip
        }
      }
      onParsed(all)
    },
    [onParsed],
  )

  return (
    <div
      className={cn(
        "relative flex h-28 w-full cursor-pointer items-center justify-center rounded border border-dashed bg-muted/40 p-4 text-sm",
        dragOver ? "border-foreground" : "border-muted-foreground/40",
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      aria-label="Upload files"
      role="button"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.xlsx,.xls"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="text-center">
        <div className="font-medium">Drop files here or click to upload</div>
        <div className="text-muted-foreground">Supported: .txt, .csv, .json, .xlsx, .xls</div>
        <div className="text-xs text-muted-foreground mt-1">Business data (sales, revenue, financial) will be analyzed automatically</div>
      </div>
    </div>
  )
}
