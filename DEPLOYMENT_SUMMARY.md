# Deployment Summary - Nov 16, 2026

## PR Merges - COMPLETED ✅

### PR #7: Answer Quality (Reasoning Model)
- **Status:** MERGED into main
- **Merge commit:** 1ef2548fb617b0edcd201fe1fa2f78fdcd1aae7c  
- **Changes:**
  - Added reasoning model setting (default: deepseek/deepseek-r1)
  - Question complexity detection for hard questions
  - Better structured answers (lead with insight, tables, action plans)
  - Better research citations and evidence strength
  - All 51 tests passing

### PR #8: Interactive Calculators
- **Status:** MERGED into main  
- **Merge commit:** 38c4eba85fd3d83b4c65ee4ddd0d8c61e1ba7e43
- **Changes:**
  - Safe calculator spec validation
  - AST-based formula evaluator (no eval())
  - Interactive React component with sliders
  - Mobile-responsive design
  - All 71 tests passing (20 new calculator tests)

### PR #9: Deployment Documentation
- **Status:** CLOSED (not merged) ✅
- **Reason:** Documentation only - proved production was running stale build

### Final Main Branch
- **HEAD:** 38c4eba85fd3d83b4c65ee4ddd0d8c61e1ba7e43
- **Includes:** PR #6 (routing fix) + PR #7 (reasoning) + PR #8 (calculators)
- **All tests passing:** 71/71 ✅

---

## Deployment Status - NEEDS MANUAL REPUBLISH ⚠️

### Current Situation
The app at https://mandara.apps.grok.bot shows "No app here", indicating it needs to be republished through the Cursor dashboard.

### To Complete Deployment:

**Option 1: Cursor Dashboard (Recommended)**
1. Open Cursor desktop app
2. Go to the Mandara project
3. Open Cursor Apps panel (Cmd/Ctrl + Shift + P → "Cursor: Publish App")
4. Select "mandara" app
5. Click "Republish" or "Update"
6. Confirm deployment to mandara.apps.grok.bot

**Option 2: If publish command exists**
```bash
cursor-publish mandara
# or
publish-app mandara
```

### After Republish: Verification Steps

**1. Check Deployed Commit**
```bash
# Should return: 38c4eba...
curl -s https://mandara.apps.grok.bot/api/version 2>/dev/null || echo "No version endpoint"
```

**2. Test Ordinary Question**
```
Message: "What were spa sales yesterday?"
Expected: Routes to sales report (mode: "sales")
Footer: "From stored sales records"
```

**3. Test Hard Math/Reasoning Question**
```
Message: "A spa does $9,500 net revenue a day. If retail is 12% and we lift it to 18% with treatment fixed at $8,360, what's the extra monthly revenue?"

Expected:
- Routes to model (NOT sales)
- Uses deepseek/deepseek-r1 (reasoning model)
- Footer shows: [Model: deepseek/deepseek-r1]
- Answer: ~$20,854/month ($695/day)
```

**4. Test Hypothetical Routing (PR #6 Fix)**
```
Message: "Hypothetical: a spa does $8,360 a day in treatment revenue and retail is currently $1,140 a day. If treatment revenue stays the same but retail rises to 18% of total revenue, how much extra revenue per day is that?"

Expected:
- Routes to MODEL (not sales) ✅
- Footer: "General assistant" or model name
- NOT "From stored sales records"
```

**5. Test Calculator Generation**
```
Message: "Create an interactive financial model for a Maldives resort with 100 villas. Show management fees with adjustable inputs: occupancy (50-100%), average room rate ($300-$800), operating margin (20-40%), base management fee (1-3%), and incentive fee on GOP (5-15%). Display annual resort revenue, operating profit, management fees, and remaining profit after fees. Include a split bar. Assume room revenue is 65% of total."

Expected:
- Text explanation + interactive calculator
- 5 sliders (occupancy, rate, margin, base fee, incentive)
- 4 computed outputs that update live
- Split bar showing operator vs remaining %
- Mobile-responsive
```

---

## What Was Fixed

### 1. Sales Routing (PR #6 - Already in main)
- **Bug:** Hypothetical questions routed to sales report
- **Fix:** `isHypotheticalQuestion()` check catches "if", "suppose", "what if", etc.
- **Status:** In main since f1168a2

### 2. Answer Quality (PR #7)
- **Added:** Reasoning model for hard questions
- **Added:** Better structure (lead with answer, tables, metrics)
- **Added:** Evidence strength for health/wellness claims
- **Cost:** ~$0.01-0.02/message for hard questions vs $0.001 for easy ones

### 3. Interactive Calculators (PR #8)
- **Added:** Safe calculator spec + evaluator
- **Added:** Interactive UI with sliders
- **Added:** Mobile-responsive design
- **Safety:** No eval(), AST-based formula evaluation

---

## Repository State

```bash
# Current branches
main: 38c4eba (latest, ready to deploy)
cursor/answer-quality-6863: merged into main
cursor/interactive-calculators-6863: merged into main  
cursor/fix-hypothetical-routing-6863: closed

# All tests passing
npm test
# tests 71
# pass 71
# fail 0
```

---

## Next Steps for Trent

1. **Republish app through Cursor dashboard** (see instructions above)
2. **Wait 1-2 minutes for deployment**
3. **Run verification tests** (see section above)
4. **Confirm:**
   - Deployed commit is 38c4eba
   - Hypothetical routing works (not going to sales)
   - Reasoning model activates for hard questions
   - Calculators render correctly
   - All features work on mobile

---

## Notes

- **DO NOT change admin model setting** - Already set to deepseek/deepseek-v4.1-flash
- **Reasoning model setting:** Default deepseek/deepseek-r1 (configurable in Admin)
- **Image model:** google/gemini-2.5-flash-image (unchanged)
- **All secrets preserved:** OPENROUTER_API_KEY, CRON_SECRET, DSR credentials

The code is ready. Just needs republish through Cursor dashboard.
