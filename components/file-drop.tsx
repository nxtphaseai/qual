"use client"

import { useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type RecordItem = {
  id: string
  text: string
  meta?: Record<string, any>
}

export default function FileDrop({ onParsed }: { onParsed: (items: RecordItem[]) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseTextFile = async (file: File): Promise<RecordItem[]> => {
    const text = await file.text()
    const parts = text
      .split(/\n\s*\n/g)
      .map((t, i) => ({ id: `${file.name}-${i + 1}`, text: t.trim() }))
      .filter((r) => r.text)
    return parts
  }

  const parseCsv = async (file: File): Promise<RecordItem[]> => {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return []
    // naive CSV parse: split by comma, no quotes handling
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const rows = lines.slice(1).map((l) => l.split(","))
    // try to find a text-like column
    const textIdx = headers.findIndex((h) => ["text", "message", "comment", "content", "body", "note"].includes(h))
    if (textIdx >= 0) {
      return rows
        .map((cols, i) => ({
          id: `${file.name}-${i + 1}`,
          text: (cols[textIdx] || "").trim(),
          meta: Object.fromEntries(headers.map((h, j) => [h, cols[j] || ""])),
        }))
        .filter((r) => r.text)
    }
    // fallback: join the row
    return rows
      .map((cols, i) => ({
        id: `${file.name}-${i + 1}`,
        text: cols.join(" ").trim(),
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
        accept=".txt,.md,.csv,.json"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="text-center">
        <div className="font-medium">Drop files here or click to upload</div>
        <div className="text-muted-foreground">Supported: .txt, .csv, .json</div>
      </div>
    </div>
  )
}
