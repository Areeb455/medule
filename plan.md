# Implementation Plan: Smart Insights & Recommendations Page

## Goal
Create a dedicated **Recommendations** page (`/recommendations`) that:
- Shows **medicinal & healthcare product recommendations** derived from the user's uploaded medical reports (PDF parser)
- Uses the same "glass card" UI style as Dashboard & Medical Report pages
- Changes the Feature card link from `/dashboard` → `/recommendations`

## What I Found
- **Frontend**: `FeaturesSection.tsx` currently links "Smart Insights & Recommendations" to `/dashboard` (the Digital Twin)
- **Backend** (`main.py`): The `/analyze-disease` endpoint already **persists** the full medical report analysis into MongoDB `disease_logs` (condition name, severity, causes, treatments, risks, summary). The `/patient/{user_id}` endpoint returns all disease logs for a user.
- **Routing**: No `/recommendations` route exists yet.
- **UI Pattern**: Existing pages use `glass`, `card-shadow`, `gradient-text`, `animate-fade-in-up`, `recharts`, and Lucide icons.

## Files to Change

### 1. `src/App.tsx`
- Add import for new `Recommendations` page
- Add `<Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />`

### 2. `src/components/FeaturesSection.tsx`
- Change `Smart Insights & Recommendations` href from `/dashboard` to `/recommendations`

### 3. `src/components/Navbar.tsx`
- Optionally add a "Recommendations" link in the nav bar for easy access

### 4. `src/pages/Recommendations.tsx` (NEW)
- Use `usePatient` hook to get `userId`, `patientName`, `authHeaders`, `API`
- Fetch user's disease logs from `GET /patient/{user_id}` (or a new endpoint)
- **If no reports**: Show friendly empty state with CTA to `/medical-report`
- **If reports exist**: Send the aggregated report data to a new backend endpoint that generates structured product recommendations using AI (Gemini/OpenRouter)
- Display results in categorized cards:
  - **Supplements & Vitamins**
  - **OTC Medications**
  - **Health Monitoring Devices**
  - **Lifestyle & Wellness Products**
- Each item shows: product name, reason based on report, priority level (High/Medium/Low)
- Include a medical disclaimer banner at the top
- Style matches existing glass-card aesthetic with animations

### 5. `server/app/main.py` (NEW endpoint)
- Add `GET /recommendations/{user_id}` endpoint:
  1. Fetch patient's `disease_logs` sorted by timestamp (limit ~10)
  2. Build a prompt asking AI to generate **healthcare product recommendations** (not medical prescriptions) based on the conditions, deficiencies, and treatments in the logs
  3. Return structured JSON like:
     ```json
     {
       "overall_summary": "string",
       "recommendations": [
         {
           "category": "Supplements & Vitamins",
           "items": [
             { "name": "Vitamin D3 1000 IU", "reason": "Low vitamin D detected", "priority": "High" }
           ]
         }
       ]
     }
     ```

## UI Flow
1. User clicks "Smart Insights & Recommendations" on homepage
2. Arrives at `/recommendations`
3. Page shows loading state → fetches their medical reports → generates AI recommendations
4. Displays categorized product cards + overall summary
5. If no reports uploaded yet, prompts them to go to `/medical-report`

## Consistency Notes
- Same `Navbar` + `FooterSection` wrapper as other pages
- Same `glass card-shadow rounded-2xl` cards
- Same `gradient-text` headings and `animate-fade-in-up` animations
- Uses `useToast` for error states

## Disclaimers
- A clear banner will state that recommendations are informational and not a substitute for professional medical advice.
