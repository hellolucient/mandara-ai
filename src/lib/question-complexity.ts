/**
 * Determines if a question needs a reasoning-capable model vs the default fast model.
 * Hard questions include: calculations with numbers, what-ifs, contract/legal analysis,
 * multi-step business analysis, and long document analysis.
 */

export function needsReasoningModel(question: string, hasAttachment: boolean, attachmentLength: number): boolean {
  const text = question.trim();
  if (!text) return false;
  
  const lower = text.toLowerCase();
  
  // Long document analysis needs reasoning
  if (hasAttachment && attachmentLength > 3000) return true;
  
  // Calculations with numbers (but not simple lookups)
  if (hasCalculationRequest(lower)) return true;
  
  // What-if scenarios with business implications
  if (hasBusinessWhatIf(lower)) return true;
  
  // Contract or legal analysis
  if (hasLegalAnalysis(lower)) return true;
  
  // Multi-step business analysis
  if (hasMultiStepAnalysis(lower)) return true;
  
  return false;
}

function hasCalculationRequest(lower: string): boolean {
  // Explicit calculation requests with "show the working" or similar
  if (/\b(show the working|work out|calculate|compute)\b/.test(lower)) {
    // Must have numbers to be a real calculation (otherwise it's just asking for general info)
    return /\d/.test(lower);
  }
  
  // Must have both numbers AND financial/business context
  const hasNumbers = /\d/.test(lower);
  if (!hasNumbers) return false;
  
  // Questions asking "how much is" or "what's the cheapest" WITHOUT calculation language are lookups, not calculations
  if (/\b(how much is|what s the cheapest|what is the|price of|cost of)\b/.test(lower)) {
    // Unless they explicitly ask for calculation or have "if" hypothetical
    if (!/\b(if |calculate|compute|difference|what s the.*\d.*off|discount|percentage|extra)\b/.test(lower)) {
      return false;
    }
  }
  
  // Financial/business terms
  const hasFinancialTerms = /\b(revenue|profit|margin|cost|price|fee|percentage|roi|break-?even|extra|impact|lift|increase.*to|decrease.*to|off|discount)\b/.test(lower);
  if (!hasFinancialTerms) return false;
  
  return true;
}

function hasBusinessWhatIf(lower: string): boolean {
  // What-if scenarios with business implications
  const hasWhatIf = /\b(what if|if we|suppose|imagine|scenario|assuming)\b/.test(lower);
  if (!hasWhatIf) return false;
  
  // Must involve business terms
  const hasBusinessTerms = /\b(revenue|sales|profit|cost|price|pricing|fee|contract|management|occupancy|growth|expand|locations?)\b/.test(lower);
  
  return hasBusinessTerms;
}

function hasLegalAnalysis(lower: string): boolean {
  // Contract, legal, or compliance analysis
  return /\b(contract|agreement|lease|legal|compliance|liability|indemnity|termination|clause|terms and conditions|gross revenue share|management fee|true-?up|acquisition)\b/.test(lower);
}

function hasMultiStepAnalysis(lower: string): boolean {
  // Questions that require multiple steps of reasoning
  
  // Explicit multi-step indicators (but not "next month", "next week", etc.)
  if (/\b(first|then|finally|step-by-step|breakdown|break down|process|workflow)\b/.test(lower)) return true;
  if (/\bnext\b/.test(lower) && !/\b(next (week|month|year|quarter|day))\b/.test(lower)) return true;
  
  // Comparison or trade-off analysis
  if (/\b(compare|comparison|versus|vs\.?|pros? and cons?|trade-?offs?|advantages? and disadvantages?|better than)\b/.test(lower)) return true;
  
  // Strategic analysis
  if (/\b(strategy|strategic|analyze|analysis|evaluate|assessment|recommendation|should (we|i)|which option|best approach)\b/.test(lower)) return true;
  
  return false;
}
