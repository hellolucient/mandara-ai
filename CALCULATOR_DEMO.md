# Calculator Demo Prompts

These prompts reliably trigger the interactive calculator feature.

## 1. Maldives Resort Management Fee Model (Recommended)

**Prompt:**
```
Create an interactive financial model for a Maldives resort with 100 villas. Show management fees with these adjustable inputs: occupancy (50-100%), average room rate ($300-$800), operating margin (20-40%), base management fee (1-3%), and incentive fee on GOP (5-15%). Display annual resort revenue, operating profit, management fees, and remaining profit after fees. Include a split bar showing operator vs remaining profit allocation. Assume room revenue is 65% of total resort revenue.
```

**Expected result:**
- Text explanation of the model
- Interactive calculator with 5 sliders
- Computed outputs: annual revenue, operating profit, management fees, remaining profit
- Split bar showing operator % vs remaining %
- Note about assumptions

---

## 2. Spa Retail Uplift Model

**Prompt:**
```
I want to build an interactive model for spa retail uplift. Create sliders for daily revenue (5000-15000), current retail percentage (5-20%), target retail percentage (10-30%), and days per month (25-31). Show the outputs: current retail revenue, target retail revenue, daily increase, and monthly increase. Make it clear how much extra revenue we'd get by lifting retail from current to target.
```

**Expected result:**
- Text explanation
- 4 input sliders
- 4 computed outputs showing the impact
- Calculations update live as sliders move

---

## 3. Lease Fee Comparison

**Prompt:**
```
Compare fixed rent vs gross revenue share for a spa lease. Create an interactive calculator with: monthly gross revenue (50k-200k), fixed rent amount (10k-40k), gross revenue share percentage (8-20%). Show outputs: revenue share amount, difference vs fixed rent, and which is better for the landlord. Include a bar showing the split of revenue.
```

**Expected result:**
- Explanation of both lease types
- 3 sliders
- Outputs showing comparison
- Bar chart showing revenue split

---

## 4. Pricing Impact Model

**Prompt:**
```
Build a pricing impact calculator. Inputs: current average treatment price (80-200), price increase percentage (0-30%), treatment volume (100-500 per week), volume drop percentage due to price increase (0-20%). Outputs: new price, new volume, current weekly revenue, new weekly revenue, net impact.
```

**Expected result:**
- Pricing strategy explanation
- 4 input controls
- 5 computed outputs
- Shows whether price increase improves revenue

---

## 5. Multi-Location Expansion Model

**Prompt:**
```
I'm thinking about expanding to more spa locations. Create an interactive model with: number of locations (1-20), revenue per location per month (30k-100k), operating margin (20-40%), fixed cost per location (15k-40k). Show total revenue, total operating profit, total fixed costs, and net profit. Add a bar showing profit vs costs allocation.
```

**Expected result:**
- Expansion analysis
- 4 sliders
- Financial outputs for the portfolio
- Visual split of profit vs costs

---

## What Makes a Good Calculator Prompt?

✅ **Good prompts:**
- Ask for "interactive model" or "calculator" explicitly
- Mention adjustable assumptions or sliders
- Specify input ranges (min/max)
- List the outputs you want to see
- Financial/business models with multiple variables

❌ **Bad prompts:**
- Simple one-off calculations ("What's 12% of 9500?")
- Questions about specific data ("What were sales yesterday?")
- Writing tasks ("Write a caption")
- Questions without adjustable variables

---

## Testing the Calculator

After deployment, test these aspects:

1. **Slider interaction:** Drag sliders smoothly, values update
2. **Live computation:** Outputs recalculate instantly
3. **Mobile responsive:** Works well on iPhone (sliders, layout)
4. **Bar chart:** Shows correct percentages, colors distinct
5. **Fallback:** If spec is invalid, shows text answer only
6. **Model logging:** Check Admin to see which model was used

---

## Expected Cost

Calculator generation uses the same model as other questions:
- **Simple questions:** Fast model (~$0.001)
- **Calculator prompts:** Likely reasoning model (~$0.01-0.02) due to complexity

The calculator itself runs client-side (no extra API cost after generation).
