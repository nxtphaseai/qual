import ResearchAgent from "@/components/research-agent"

export default function Page() {
  return (
    <main className="min-h-[100dvh] w-full">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">Research Agent</h1>
        <p className="text-muted-foreground mt-2 ">
          Draft a plan, review it, and execute research to compile a briefing with sources.
        </p>
        <div className="mt-6">
          <ResearchAgent />
        </div>
      </div>
    </main>
  )
}
