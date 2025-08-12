import { STOPWORDS } from "./stopwords"
import { AFINN } from "./afinn"

type Task = "summary" | "themes" | "sentiment" | "entities" | "quotes"

type RecordItem = { id: string; text: string; meta?: Record<string, any> }

export type AnalyzeOptions = {
  tasks: Task[]
  questions?: string
}

export function analyzeLocal(data: RecordItem[], options: AnalyzeOptions) {
  const { tasks, questions = "" } = options

  const texts = data.map((d) => normalizeWhitespace(d.text)).filter(Boolean)
  // Sentence-level units for quotes/sentiment
  const sentences = texts
    .flatMap(splitSentences)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const focus = extractFocusTerms(questions)

  // Keyword frequencies
  const { termFreq, topKeywords } = getKeywords(texts, focus)

  // Themes: top N keywords grouped with examples
  const themes = tasks.includes("themes") ? buildThemes(texts, termFreq, 12) : []

  // Summary: take top sentences by coverage of top keywords
  const summary = tasks.includes("summary") ? summarize(sentences, topKeywords, 5) : []

  // Sentiment: simple lexicon-based scoring
  const sentiment = tasks.includes("sentiment") ? sentimentAnalysis(sentences) : emptySentiment()

  // Entities: regex-based extraction
  const entities = tasks.includes("entities") ? extractEntities(texts.join("\n")) : emptyEntities()

  // Quotes: pick representative high-ranked sentences
  const quotes = tasks.includes("quotes") ? pickQuotes(sentences, topKeywords, 10) : []

  const keywords = topKeywords.map(([term, count]) => ({ term, count }))

  return { summary, themes, sentiment, entities, quotes, keywords }
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim()
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z"“‘])/g)
}

function tokenize(s: string) {
  return s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []
}

function isStop(word: string) {
  return STOPWORDS.has(word)
}

function stem(word: string) {
  // naive stemmer: common suffixes
  return word.replace(/(ing|ed|ly|ness|ment|tion|s)$/i, "")
}

function extractFocusTerms(q: string) {
  const tokens = tokenize(q)
    .filter((w) => !isStop(w))
    .map(stem)
  return new Set(tokens)
}

function getKeywords(texts: string[], focus: Set<string>) {
  const freq = new Map<string, number>()
  for (const t of texts) {
    const seen = new Set<string>()
    for (const w of tokenize(t)) {
      if (isStop(w)) continue
      const s = stem(w)
      if (s.length < 3) continue
      // count unique terms per document to reduce long-doc bias
      if (seen.has(s)) continue
      seen.add(s)
      const boost = focus.has(s) ? 2 : 1
      freq.set(s, (freq.get(s) || 0) + boost)
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1])
  return { termFreq: freq, topKeywords: sorted.slice(0, 50) }
}

function buildThemes(texts: string[], freq: Map<string, number>, k: number) {
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(6, k))
  const themes = top.map(([term, count]) => {
    const examples: string[] = []
    for (const t of texts) {
      if (examples.length >= 5) break
      // pick sentences that mention the term
      const sents = splitSentences(t).filter((s) => s.toLowerCase().includes(term))
      if (sents.length) examples.push(sents[0].trim())
    }
    // expand keywords: find near neighbors by co-occurrence
    const neighbors = getNeighbors(texts, term).slice(0, 6)
    return { name: capitalize(term), keywords: [term, ...neighbors], count, examples }
  })

  // Deduplicate themes with similar names
  const uniq: typeof themes = []
  const seen = new Set<string>()
  for (const th of themes) {
    const key = th.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    uniq.push(th)
  }
  return uniq.slice(0, k)
}

function getNeighbors(texts: string[], term: string) {
  const counts = new Map<string, number>()
  for (const t of texts) {
    if (!t.toLowerCase().includes(term)) continue
    const window = tokenize(t)
    for (const w of window) {
      if (isStop(w)) continue
      const s = stem(w)
      if (s === term) continue
      counts.set(s, (counts.get(s) || 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w)
}

function summarize(sentences: string[], topKeywords: [string, number][], limit: number) {
  const topTerms = new Set(topKeywords.slice(0, 20).map(([t]) => t))
  const scored = sentences.map((s) => {
    const toks = tokenize(s).map(stem)
    let score = 0
    for (const t of toks) {
      if (topTerms.has(t)) score += 1
    }
    // prefer mid-length sentences
    const len = s.length
    const lengthScore = len >= 60 && len <= 220 ? 1 : 0
    return { s, score: score + lengthScore }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s)
}

function sentimentAnalysis(sentences: string[]) {
  const scores = sentences.map((s) => {
    let sum = 0
    let count = 0
    for (const w of tokenize(s)) {
      if (AFINN.hasOwnProperty(w)) {
        sum += (AFINN as Record<string, number>)[w]
        count++
      }
    }
    return { s, score: sum, norm: count ? sum / (count * 5) : 0 } // normalize to ~ -1..1
  })
  const distribution = { positive: 0, neutral: 0, negative: 0 }
  const topPositive: string[] = []
  const topNegative: string[] = []

  for (const { s, norm } of scores) {
    if (norm > 0.15) distribution.positive++
    else if (norm < -0.15) distribution.negative++
    else distribution.neutral++
  }
  topPositive.push(
    ...scores
      .sort((a, b) => b.norm - a.norm)
      .slice(0, 3)
      .map((x) => x.s),
  )
  topNegative.push(
    ...scores
      .sort((a, b) => a.norm - b.norm)
      .slice(0, 3)
      .map((x) => x.s),
  )
  const avg = scores.length ? scores.reduce((a, c) => a + c.norm, 0) / scores.length : 0
  return { distribution, topPositive, topNegative, average: clamp(avg, -1, 1) }
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x))
}

function extractEntities(text: string) {
  const emails = uniqMatches(text, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)
  const urls = uniqMatches(text, /\bhttps?:\/\/[^\s)]+/g)
  const hashtags = uniqMatches(text, /#[\p{L}\p{N}_-]+/gu)
  const money = uniqMatches(text, /[$€£]\s?\d+(?:[,.\d]+)?/g)
  const dates = uniqMatches(
    text,
    /\b(?:\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?)\b/gi,
  )

  // Simple proper nouns: capitalized words not at start of sentence
  const proper = uniqMatches(text, /(?<!\.|!|\?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g).map((s) => s.trim())

  // naive buckets
  const people: string[] = []
  const orgs: string[] = []
  const locs: string[] = []
  const misc: string[] = []

  for (const p of proper) {
    if (/\b(Inc\.|Corp\.|LLC|Ltd|Company|Co\.)\b/.test(p)) orgs.push(p)
    else if (/\b(Street|St\.|Road|Rd\.|Avenue|Ave\.|City|Park|Valley)\b/.test(p)) locs.push(p)
    else if (!people.includes(p)) people.push(p)
  }

  return {
    people: uniq(people).slice(0, 50),
    organizations: uniq(orgs).slice(0, 50),
    locations: uniq(locs).slice(0, 50),
    emails,
    urls,
    hashtags,
    money,
    dates,
    misc: uniq(misc).slice(0, 50),
  }
}

function uniqMatches(text: string, re: RegExp) {
  const set = new Set<string>()
  let m: RegExpExecArray | null
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g"
  const regex = new RegExp(re.source, flags)
  while ((m = regex.exec(text)) !== null) {
    const val = (m[0] || "").trim()
    if (val) set.add(val)
  }
  return [...set]
}

function uniq<T>(arr: T[]) {
  return [...new Set(arr)]
}

function pickQuotes(sentences: string[], topKeywords: [string, number][], limit: number) {
  const topTerms = new Set(topKeywords.slice(0, 20).map(([t]) => t))
  const scored = sentences.map((s) => {
    const toks = tokenize(s).map(stem)
    let score = 0
    for (const t of toks) {
      if (topTerms.has(t)) score += 1
    }
    return { s, score }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function emptySentiment() {
  return { distribution: { positive: 0, neutral: 0, negative: 0 }, topPositive: [], topNegative: [], average: 0 }
}
function emptyEntities() {
  return {
    people: [],
    organizations: [],
    locations: [],
    emails: [],
    urls: [],
    hashtags: [],
    money: [],
    dates: [],
    misc: [],
  }
}
