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
  // Must have both numbers AND calculation indicators
  const hasNumbers = /\d/.test(lower);
  if (!hasNumbers) return false;
  
  // Calculation keywords
  const calcWords = /\b(calculate|compute|work out|show the working|what'?s the|how much|extra|impact|difference|change)\b/.test(lower);
  if (!calcWords) return false;
  
  // Financial/business terms make it more likely to be complex
  const hasFinancialTerms = /\b(revenue|profit|margin|cost|price|fee|percentage|roi|break-?even)\b/.test(lower);
  
  return hasFinancialTerms || calcWords;
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
  
  // Explicit multi-step indicators
  if (/\b(first|then|next|finally|step-by-step|breakdown|break down|process|workflow)\b/.test(lower)) return true;
  
  // Comparison or trade-off analysis
  if (/\b(compare|comparison|versus|vs\.?|pros? and cons?|trade-?offs?|advantages? and disadvantages?|better than)\b/.test(lower)) return true;
  
  // Strategic analysis
  if (/\b(strategy|strategic|analyze|analysis|evaluate|assessment|recommendation|should (we|i)|which option|best approach)\b/.test(lower)) return true;
  
  return false;
}
