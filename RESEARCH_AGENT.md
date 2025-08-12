# Research Agent Documentation

## Overview

The Research Agent is an intelligent research automation tool that helps you quickly gather comprehensive information on any topic. It follows a structured approach: first drafting a customizable research plan, then executing that plan with real-time streaming updates, and finally generating a professional briefing with exportable PDF reports.

## How It Works

### Step-by-Step Process

#### 1. **Define the Brief**
- **Input your research topic**: Use the combobox to select from pre-defined examples or enter a custom topic
- **Provide context**: Describe your situation, upcoming meetings, or specific background information
- **Set your goals**: Define what you want to achieve (e.g., "Brief me for an investor call", "Compare solutions objectively")
- **Configure settings**:
  - **Model selection**: Choose from GPT-5, GPT-4o, GPT-4o Mini, o3-mini, o1-preview, or o1-mini
  - **Reasoning effort**: Low/Medium/High (affects depth and cost when supported by models like o3-mini)
  - **Timebox**: Set research duration (10 minutes to 2 hours)

#### 2. **Draft a Plan**
- Click "Draft a plan" to generate an intelligent research strategy
- The AI analyzes your brief and creates:
  - **Key questions** to answer during research
  - **Clarifying questions** for additional context
  - **Research steps** with specific queries and expected outputs
  - **Final synthesis step** (always included) for report generation

#### 3. **Review and Customize the Plan**
- **Edit step titles** and rationales to match your needs
- **Modify search queries** for each step
- **Adjust expected outputs** to focus on specific information
- **Toggle steps** to include/skip as needed
- **Add manual steps** with the "Add step" button
- **Delete steps** that aren't relevant

#### 4. **Execute Research**
- Click "Approve & Execute" to begin automated research
- The interface automatically collapses brief and plan sections for clean viewing
- **Real-time progress tracking**:
  - Progress bar showing completion status
  - Individual step status with thinking indicators
  - Dynamic activity messages (e.g., "Analyzing sources...", "Cross-referencing information...")
  - Live streaming of research findings

#### 5. **Review Results**
- **Step-by-step results** with sources and summaries
- **Auto-collapsing completed steps** (after 3 seconds) to maintain focus
- **Expandable sections** for detailed review when needed
- **Final comprehensive report** with executive summary and PDF export capability

## Cool Features

### 🎯 **Smart Planning**
- AI-generated research strategies tailored to your specific context
- Intelligent query formulation and step sequencing
- Customizable and editable plans before execution

### 🔄 **Real-Time Streaming**
- Live progress updates during research execution
- Dynamic "thinking" indicators with rotating activity messages
- Immediate visibility into what the agent is currently working on

### 🎨 **Adaptive UI**
- **Collapsible sections** that auto-hide during execution for distraction-free monitoring
- **Smart expansion logic** - completed steps auto-close while keeping current work visible
- **Responsive design** that works across different screen sizes

### 💾 **Persistent State**
- Automatic saving of research parameters to localStorage
- Resume work where you left off
- No data loss between sessions

### 📊 **Comprehensive Reporting**
- Professional briefing documents with multiple sections
- Source attribution and credibility tracking
- PDF export functionality for sharing and archiving

### ⚡ **Flexible Configuration**
- Multiple AI model options for different use cases and budgets
- Reasoning effort control for balancing depth vs. speed/cost
- Configurable research timeboxes

## Example Use Cases

### Business Intelligence
- **Industry research** before investor meetings
- **Competitive analysis** for strategic planning
- **Market sizing** and opportunity assessment
- **Regulatory landscape** understanding

### Due Diligence
- **Startup evaluation** and investment research
- **Vendor assessment** and technology evaluation
- **Risk analysis** and compliance research

### Professional Preparation
- **Meeting preparation** with targeted briefings
- **Expert interviews** with intelligent question generation
- **Conference speaking** with comprehensive topic research

## Potential Improvements

### 🚀 **Enhanced Intelligence**
- **Multi-language support** for global research
- **Real-time fact checking** with confidence scores
- **Automatic source quality assessment** and ranking
- **Cross-step information synthesis** for deeper insights

### 🔧 **Advanced Features**
- **Research templates** for common scenarios (due diligence, competitive analysis, etc.)
- **Collaborative research** with team sharing and comments
- **API integrations** with proprietary databases and research tools
- **Custom output formats** (presentations, executive memos, research papers)

### 🎛️ **Enhanced Customization**
- **Industry-specific research methodologies** (healthcare, finance, technology)
- **Configurable source preferences** and filtering
- **Advanced scheduling** for recurring research updates
- **Custom thinking activities** and progress indicators

### 📈 **Analytics & Insights**
- **Research quality metrics** and effectiveness tracking
- **Source diversity analysis** and bias detection
- **Time and cost optimization** recommendations
- **Research history** and pattern analysis

### 🔐 **Enterprise Features**
- **Advanced security** and data protection
- **Integration with enterprise tools** (CRM, document management)
- **Role-based access control** and approval workflows
- **Audit trails** and compliance reporting

## FAQ

### **Q: How long does a typical research session take?**
**A:** Research duration is configurable from 10 minutes to 2 hours. The actual time depends on the complexity of your topic, the number of steps in your plan, and the reasoning effort level selected. Most business briefings complete within 20-30 minutes.

### **Q: Which AI model should I choose?**
**A:** 
- **GPT-5**: Best overall performance and latest capabilities
- **GPT-4o**: Excellent balance of quality and speed
- **GPT-4o Mini**: Faster and more cost-effective for simpler research
- **o3-mini**: Supports advanced reasoning effort settings
- **o1-preview/o1-mini**: Optimized for complex reasoning tasks

### **Q: What happens if I cancel research midway?**
**A:** You can cancel at any time using the "Cancel" button. All completed steps and gathered information will be preserved, and you can review partial results or restart the process.

### **Q: Can I modify the plan after starting research?**
**A:** The plan becomes read-only during execution to maintain consistency. However, you can cancel the current research, modify the plan, and restart execution with your changes.

### **Q: How are sources validated and ranked?**
**A:** The agent evaluates sources based on credibility, relevance, and recency. It prioritizes authoritative sources like academic papers, government reports, and established news outlets while noting potential biases or limitations.

### **Q: Is my research data saved?**
**A:** Research parameters (topic, context, goals, model settings) are saved locally in your browser for convenience. Completed research results and reports are temporarily stored for the session but not permanently saved unless you export them.

### **Q: Can I use this for academic research?**
**A:** While the Research Agent is excellent for business intelligence and professional preparation, academic research typically requires specialized methodologies, peer review, and citation standards. Use it as a starting point, but supplement with traditional academic research methods.

### **Q: What types of sources does it access?**
**A:** The agent searches across web sources, news articles, reports, and publicly available databases. It cannot access proprietary databases, paywalled content, or confidential information unless specifically configured with appropriate access credentials.

### **Q: How do I get the best results?**
**A:** 
- **Be specific** in your context and goals
- **Review and customize** the generated plan before execution
- **Choose appropriate models** based on your needs
- **Set realistic timeboxes** for comprehensive coverage
- **Use examples** from the dropdown for inspiration on effective briefing structures

### **Q: Can I export or share the results?**
**A:** Yes! The final report includes PDF export functionality, allowing you to save, share, or archive your research briefings. The reports include proper source attribution and professional formatting.

### **Q: Does it work for highly specialized or technical topics?**
**A:** The agent performs well on most business and general technical topics. For highly specialized fields (advanced medical research, cutting-edge scientific papers), results quality depends on the availability of accessible sources and may benefit from expert review.

---

*Last updated: $(date)*