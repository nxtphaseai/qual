"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts"

export type AnalyzeResult = {
  summary: string[]
  themes: Array<{ name: string; keywords: string[]; count: number; examples: string[] }>
  sentiment: {
    distribution: { positive: number; neutral: number; negative: number }
    topPositive: string[]
    topNegative: string[]
    average: number // -1..1
  }
  entities: {
    people: string[]
    organizations: string[]
    locations: string[]
    emails: string[]
    urls: string[]
    hashtags: string[]
    money: string[]
    dates: string[]
    misc: string[]
  }
  quotes: string[]
  keywords: Array<{ term: string; count: number }>
}

export default function ResultsView({ result }: { result: AnalyzeResult }) {
  const themeData = result.themes.slice(0, 10).map((t) => ({ theme: t.name, count: t.count }))
  const sentimentBars = [
    { label: "Positive", value: result.sentiment.distribution.positive },
    { label: "Neutral", value: result.sentiment.distribution.neutral },
    { label: "Negative", value: result.sentiment.distribution.negative },
  ]
  const avgPct = Math.round(((result.sentiment.average + 1) / 2) * 100)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Key takeaways</CardDescription>
          </CardHeader>
          <CardContent>
            {result.summary.length ? (
              <ul className="list-disc pl-5 space-y-2">
                {result.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No summary available.</p>
            )}
          </CardContent>
        </Card>

        {/* Themes */}
        <Card>
          <CardHeader>
            <CardTitle>Themes</CardTitle>
            <CardDescription>Top recurring topics with supporting quotes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.themes.length === 0 && <p className="text-muted-foreground">No themes detected.</p>}
            {result.themes.slice(0, 8).map((t, idx) => (
              <div key={idx} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{t.name}</h3>
                    <Badge variant="secondary">{t.count}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.keywords.slice(0, 6).map((k, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="space-y-2">
                  {t.examples.slice(0, 3).map((q, i) => (
                    <blockquote key={i} className="text-sm italic text-muted-foreground">
                      {q}
                    </blockquote>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quotes */}
        <Card>
          <CardHeader>
            <CardTitle>Notable Quotes</CardTitle>
            <CardDescription>Representative lines from the data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.quotes.length ? (
              result.quotes.slice(0, 10).map((q, i) => (
                <blockquote key={i} className="rounded bg-muted p-3 text-sm italic">
                  {q}
                </blockquote>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No quotes found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Sentiment */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment</CardTitle>
            <CardDescription>Distribution and average</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer
              config={{
                bar: { label: "Responses", color: "hsl(var(--chart-2))" },
              }}
              className="h-[220px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentBars}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Bar dataKey="value" fill="var(--color-bar)" radius={[4, 4, 0, 0]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="text-sm text-muted-foreground">
              Average polarity: <span className="font-medium text-foreground">{avgPct}%</span> toward positive
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-xs font-medium">Top positive</div>
                <ul className="text-xs text-emerald-700 dark:text-emerald-400 list-disc pl-5 space-y-1">
                  {result.sentiment.topPositive.slice(0, 3).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-medium">Top negative</div>
                <ul className="text-xs text-red-700 dark:text-red-400 list-disc pl-5 space-y-1">
                  {result.sentiment.topNegative.slice(0, 3).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Keywords */}
        <Card>
          <CardHeader>
            <CardTitle>Keywords</CardTitle>
            <CardDescription>Most frequent terms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.keywords.slice(0, 20).map((k, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate">{k.term}</span>
                <Badge variant="outline">{k.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Theme frequency chart */}
        <Card>
          <CardHeader>
            <CardTitle>Theme Frequency</CardTitle>
            <CardDescription>Top themes (count)</CardDescription>
          </CardHeader>
          <CardContent>
            {themeData.length ? (
              <ChartContainer
                config={{ freq: { label: "Mentions", color: "hsl(var(--chart-3))" } }}
                className="h-[260px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={themeData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="theme" axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <Bar dataKey="count" fill="var(--color-freq)" radius={[4, 4, 0, 0]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No themes to chart.</p>
            )}
          </CardContent>
        </Card>

        {/* Entities */}
        <Card>
          <CardHeader>
            <CardTitle>Entities</CardTitle>
            <CardDescription>Detected items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(result.entities).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 font-medium capitalize">{k}</div>
                {v.length ? (
                  <div className="flex flex-wrap gap-1">
                    {v.slice(0, 30).map((e, i) => (
                      <Badge key={i} variant="secondary">
                        {e}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">—</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
