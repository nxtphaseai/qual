"use client"

import React, { useState } from 'react'
import EntityModal from './entity-modal'

interface EntityTextProps {
  text: string
  className?: string
}

// Enhanced patterns for intelligent entity extraction
const ENTITY_PATTERNS = [
  // Major tech companies and brands
  /\b(Apple|Google|Microsoft|Amazon|Meta|Facebook|Tesla|Netflix|Spotify|Adobe|Oracle|Salesforce|IBM|Intel|AMD|Qualcomm|Broadcom|Samsung|Sony|LG|Huawei|Xiaomi|ByteDance|TikTok|Twitter|LinkedIn|YouTube|Instagram|WhatsApp|Slack|Zoom|Shopify|Square|PayPal|Stripe|Uber|Lyft|Airbnb|DoorDash|Instacart)\b/g,
  
  // Company suffixes
  /\b([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\s+(?:Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|Limited|Co\.?|Company|Group|Holdings|Technologies|Tech|Systems|Solutions|Services|Ventures|Partners|Associates|Enterprises|Industries)\b/g,
  
  // Technology and product terms
  /\b(iPhone|iPad|MacBook|Windows|Xbox|PlayStation|Android|Chrome|Safari|Firefox|React|Angular|Vue|Node\.js|TypeScript|JavaScript|Python|Java|C\+\+|Swift|Kotlin|AWS|Azure|Google Cloud|GCP|Docker|Kubernetes|TensorFlow|PyTorch|OpenAI|GPT|ChatGPT|Claude|Gemini|GitHub|GitLab|Jira|Confluence|Figma|Photoshop|Illustrator|InDesign|WordPress|Shopify|WooCommerce|Magento)\b/g,
  
  // AI and ML terms
  /\b(Artificial\s+Intelligence|Machine\s+Learning|Deep\s+Learning|Neural\s+Networks?|Natural\s+Language\s+Processing|Computer\s+Vision|Large\s+Language\s+Models?|Generative\s+AI|ChatGPT|GPT-4|GPT-3|BERT|Transformer|CNN|RNN|LSTM|GAN|Reinforcement\s+Learning|Supervised\s+Learning|Unsupervised\s+Learning|Transfer\s+Learning|AutoML|MLOps|AI\s+Ethics)\b/gi,
  
  // Business and finance terms
  /\b(NASDAQ|NYSE|S&P\s*500|Dow\s*Jones|Fortune\s*500|FTSE|DAX|Nikkei|Russell\s*2000|IPO|API|SaaS|PaaS|IaaS|B2B|B2C|FinTech|InsurTech|PropTech|EdTech|HealthTech|CleanTech|RegTech|AdTech|MarTech|HR\s+Tech|Supply\s+Chain|ESG|KPI|ROI|EBITDA|P\/E\s+Ratio|Market\s+Cap|Revenue|Valuation)\b/gi,
  
  // Industry verticals
  /\b(Healthcare|Biotechnology|Pharmaceuticals|Telecommunications|Automotive|Aerospace|Defense|Energy|Renewable\s+Energy|Oil\s+and\s+Gas|Mining|Agriculture|Real\s+Estate|Construction|Manufacturing|Retail|E-commerce|Logistics|Transportation|Hospitality|Entertainment|Media|Gaming|Sports|Fashion|Food\s+and\s+Beverage|Consumer\s+Goods|Financial\s+Services|Banking|Insurance|Investment|Private\s+Equity|Venture\s+Capital)\b/gi,
  
  // Cryptocurrencies and blockchain
  /\b(Bitcoin|Ethereum|Blockchain|Cryptocurrency|DeFi|NFT|Web3|Smart\s+Contracts|Solidity|Dogecoin|Litecoin|Cardano|Polkadot|Chainlink|Polygon|Avalanche|Solana|Binance|Coinbase|MetaMask|OpenSea|Uniswap|Compound|Aave|MakerDAO|Stablecoin|USDC|USDT|Tether)\b/g,
  
  // Cloud and infrastructure
  /\b(Cloud\s+Computing|Infrastructure\s+as\s+a\s+Service|Platform\s+as\s+a\s+Service|Software\s+as\s+a\s+Service|Microservices|API\s+Gateway|Load\s+Balancer|Content\s+Delivery\s+Network|CDN|DevOps|CI\/CD|Continuous\s+Integration|Continuous\s+Deployment|Agile|Scrum|Kanban|Version\s+Control|Git|GitOps|Serverless|Edge\s+Computing|Hybrid\s+Cloud|Multi-Cloud)\b/gi,
  
  // Cybersecurity terms
  /\b(Cybersecurity|Information\s+Security|Data\s+Privacy|GDPR|CCPA|Zero\s+Trust|Multi-Factor\s+Authentication|MFA|Single\s+Sign-On|SSO|Encryption|VPN|Firewall|Antivirus|Malware|Ransomware|Phishing|Social\s+Engineering|Penetration\s+Testing|Vulnerability\s+Assessment|SOC|SIEM|Incident\s+Response|Threat\s+Intelligence|Identity\s+and\s+Access\s+Management|IAM)\b/gi,
  
  // Regulations and standards
  /\b(ISO\s+\d+|SOX|HIPAA|PCI\s+DSS|FedRAMP|SOC\s+[12]|NIST|OWASP|IEEE|W3C|IETF|RFC\s+\d+|ANSI|IEC|ASTM|FDA|SEC|FTC|CFTC|FINRA|Basel\s+III|MiFID\s+II|PSD2)\b/g
]

export default function EntityText({ text, className = "" }: EntityTextProps) {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const extractEntities = (inputText: string): Array<{ text: string; isEntity: boolean; entity?: string }> => {
    const entities = new Set<string>()
    const entityPositions = new Map<string, Array<{ start: number; end: number }>>()

    // Find all entities using patterns
    ENTITY_PATTERNS.forEach(pattern => {
      let match
      const regex = new RegExp(pattern.source, pattern.flags)
      
      while ((match = regex.exec(inputText)) !== null) {
        const entity = match[1] || match[0]
        const cleanEntity = entity.trim()
        
        // Skip very common words or single letters
        if (cleanEntity.length < 2 || 
            /^(The|A|An|And|Or|But|In|On|At|To|For|Of|With|By|From|Up|About|Into|Through|During|Before|After|Above|Below|Between|Among|Across|Against|Towards|Upon|Within|Without|Under|Over)$/i.test(cleanEntity)) {
          continue
        }
        
        entities.add(cleanEntity)
        if (!entityPositions.has(cleanEntity)) {
          entityPositions.set(cleanEntity, [])
        }
        entityPositions.get(cleanEntity)!.push({
          start: match.index!,
          end: match.index! + match[0].length
        })
      }
    })

    // Convert to array of text segments
    const segments: Array<{ text: string; isEntity: boolean; entity?: string }> = []
    let currentIndex = 0
    
    // Sort all entity positions
    const allPositions: Array<{ start: number; end: number; entity: string }> = []
    entityPositions.forEach((positions, entity) => {
      positions.forEach(pos => {
        allPositions.push({ ...pos, entity })
      })
    })
    allPositions.sort((a, b) => a.start - b.start)

    // Remove overlapping entities (keep the first one)
    const nonOverlapping: Array<{ start: number; end: number; entity: string }> = []
    for (const pos of allPositions) {
      const isOverlapping = nonOverlapping.some(existing => 
        (pos.start >= existing.start && pos.start < existing.end) ||
        (pos.end > existing.start && pos.end <= existing.end) ||
        (pos.start <= existing.start && pos.end >= existing.end)
      )
      if (!isOverlapping) {
        nonOverlapping.push(pos)
      }
    }

    // Build segments
    for (const pos of nonOverlapping) {
      // Add text before entity
      if (pos.start > currentIndex) {
        const beforeText = inputText.slice(currentIndex, pos.start)
        if (beforeText) {
          segments.push({ text: beforeText, isEntity: false })
        }
      }

      // Add entity
      const entityText = inputText.slice(pos.start, pos.end)
      segments.push({ text: entityText, isEntity: true, entity: pos.entity })
      currentIndex = pos.end
    }

    // Add remaining text
    if (currentIndex < inputText.length) {
      const remainingText = inputText.slice(currentIndex)
      if (remainingText) {
        segments.push({ text: remainingText, isEntity: false })
      }
    }

    return segments.length > 0 ? segments : [{ text: inputText, isEntity: false }]
  }

  const handleEntityClick = (entity: string) => {
    setSelectedEntity(entity)
    setModalOpen(true)
  }

  const segments = extractEntities(text)

  return (
    <>
      <div className={className}>
        {segments.map((segment, index) => (
          segment.isEntity ? (
            <button
              key={index}
              onClick={() => handleEntityClick(segment.entity!)}
              className="text-blue-600 hover:text-blue-800 underline decoration-dotted underline-offset-2 cursor-pointer transition-colors duration-200 hover:bg-blue-50 px-0.5 rounded"
              title={`Click to learn more about ${segment.entity}`}
            >
              {segment.text}
            </button>
          ) : (
            <span key={index}>{segment.text}</span>
          )
        ))}
      </div>

      <EntityModal
        entity={selectedEntity}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedEntity(null)
        }}
      />
    </>
  )
}