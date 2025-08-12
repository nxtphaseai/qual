"use client"

import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import EntityModal from './entity-modal'

interface LockedEntityMarkdownProps {
  children: string
  className?: string
  isComplete: boolean // Only apply entity extraction when step is complete
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
  /\b(ISO\s+\d+|SOX|HIPAA|PCI\s+DSS|FedRAMP|SOC\s+[12]|NIST|OWASP|IEEE|W3C|IETF|RFC\s+\d+|ANSI|IEC|ASTM|FDA|SEC|FTC|CFTC|FINRA|Basel\s+III|MiFID\s+II|PSD2)\b/g,

  // Biology/medical terms
  /\b(Peptides?|Proteins?|Amino\s+Acids?|Antibodies|Vaccines?|Therapeutics?|Pharmacology|Clinical\s+Trials?|FDA|EMA|Biomarkers?|Genomics?|Proteomics?|Immunotherapy|Gene\s+Therapy|Cell\s+Therapy|Stem\s+Cells?|CRISPR|mRNA|DNA|RNA|Enzymes?|Hormones?|Insulin|Growth\s+Hormone|Collagen|Elastin|GLP-1|Glucagon)\b/gi
]

export default function LockedEntityMarkdown({ children, className = "", isComplete }: LockedEntityMarkdownProps) {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [hasProcessedEntities, setHasProcessedEntities] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<string>("")

  const handleEntityClick = (entity: string) => {
    setSelectedEntity(entity)
    setModalOpen(true)
  }


  // Only process entities when step is complete and content hasn't been processed yet
  useEffect(() => {
    if (!isComplete || !containerRef.current || hasProcessedEntities || contentRef.current === children) {
      return
    }

    // Update content reference
    contentRef.current = children

    const addEntityLinks = () => {
      const container = containerRef.current!
      const textNodes: Text[] = []
      
      // Find all text nodes
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      )
      
      let node
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text)
      }

      // Process each text node
      textNodes.forEach(textNode => {
        const text = textNode.textContent || ''
        if (text.trim().length === 0) return

        let hasEntity = false
        const entities: Array<{ start: number; end: number; entity: string }> = []

        // Find entities in this text node
        ENTITY_PATTERNS.forEach(pattern => {
          let match
          const regex = new RegExp(pattern.source, pattern.flags)
          
          while ((match = regex.exec(text)) !== null) {
            const entity = match[1] || match[0]
            const cleanEntity = entity.trim()
            
            if (cleanEntity.length < 2 || 
                /^(The|A|An|And|Or|But|In|On|At|To|For|Of|With|By|From|Up|About|Into|Through|During|Before|After|Above|Below|Between|Among|Across|Against|Towards|Upon|Within|Without|Under|Over)$/i.test(cleanEntity)) {
              continue
            }
            
            entities.push({
              start: match.index!,
              end: match.index! + match[0].length,
              entity: cleanEntity
            })
            hasEntity = true
          }
        })

        if (!hasEntity) return

        // Sort entities by position and remove overlaps
        entities.sort((a, b) => a.start - b.start)
        const nonOverlapping = entities.filter((pos, index) => {
          return !entities.some((other, otherIndex) => 
            otherIndex < index && 
            pos.start >= other.start && 
            pos.start < other.end
          )
        })

        if (nonOverlapping.length === 0) return

        // Create new content with entity buttons
        const fragment = document.createDocumentFragment()
        let currentIndex = 0

        nonOverlapping.forEach(({ start, end, entity }) => {
          // Add text before entity
          if (start > currentIndex) {
            const beforeText = text.slice(currentIndex, start)
            fragment.appendChild(document.createTextNode(beforeText))
          }

          // Add entity button
          const button = document.createElement('button')
          button.textContent = text.slice(start, end)
          button.className = 'text-blue-600 hover:text-blue-800 underline decoration-solid underline-offset-2 cursor-pointer transition-colors duration-200 hover:bg-blue-50 px-0.5 rounded font-medium'
          button.title = `Click to learn more about ${entity}`
          button.onclick = (e) => {
            e.preventDefault()
            handleEntityClick(entity)
          }
          fragment.appendChild(button)
          currentIndex = end
        })

        // Add remaining text
        if (currentIndex < text.length) {
          const remainingText = text.slice(currentIndex)
          fragment.appendChild(document.createTextNode(remainingText))
        }

        // Replace the text node with the new content
        textNode.parentNode?.replaceChild(fragment, textNode)
      })
    }

    // Run after ReactMarkdown has rendered and mark as processed
    const timeout = setTimeout(() => {
      addEntityLinks()
      setHasProcessedEntities(true)
    }, 0)
    return () => clearTimeout(timeout)
  }, [children, isComplete, hasProcessedEntities, handleEntityClick])

  // Reset processing state when content changes significantly
  useEffect(() => {
    if (children !== contentRef.current) {
      setHasProcessedEntities(false)
    }
  }, [children])

  return (
    <>
      <div ref={containerRef} className={`${className} break-words overflow-wrap-anywhere`}>
        <ReactMarkdown 
          components={{
            // Ensure proper text wrapping and overflow handling
            p: ({ children, ...props }) => (
              <p {...props} className="break-words whitespace-pre-wrap">
                {children}
              </p>
            ),
            li: ({ children, ...props }) => (
              <li {...props} className="break-words">
                {children}
              </li>
            ),
            // Improve link styling
            a: ({ children, href, ...props }) => (
              <a 
                {...props} 
                href={href}
                className="text-blue-600 hover:text-blue-800 underline decoration-solid underline-offset-2 cursor-pointer transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            // Add proper word wrapping to all text elements
            h1: ({ children, ...props }) => <h1 {...props} className="break-words">{children}</h1>,
            h2: ({ children, ...props }) => <h2 {...props} className="break-words">{children}</h2>,
            h3: ({ children, ...props }) => <h3 {...props} className="break-words">{children}</h3>,
            h4: ({ children, ...props }) => <h4 {...props} className="break-words">{children}</h4>,
            h5: ({ children, ...props }) => <h5 {...props} className="break-words">{children}</h5>,
            h6: ({ children, ...props }) => <h6 {...props} className="break-words">{children}</h6>,
          }}
        >
          {children}
        </ReactMarkdown>
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