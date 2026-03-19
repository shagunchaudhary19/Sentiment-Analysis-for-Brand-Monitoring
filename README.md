# Brand Sentiment Monitor – Frontend

Modern single-page dashboard UI for **AI-based sentiment analysis and brand monitoring**.  
This frontend is framework-free (plain HTML + JavaScript) and styled with Tailwind CSS via CDN.

> 🔧 The data is mocked in `app.js`. Replace the mock loader with your own AI sentiment API to go live.

---

## Features

- **Brand selector**: Switch between multiple brands and see sentiment for each.
- **Date range presets**: 24h / 7 days / 30 days.
- **Channel filters**: Toggle Twitter/X, Instagram, News, and Reviews.
- **KPI cards**:
  - Total mentions
  - Average sentiment score
  - Positive / Neutral / Negative split
  - Average reach per mention
- **Trend chart**: Positive vs negative mentions over time.
- **Recent mentions feed**: Highest‑impact posts and reviews with sentiment badges.
- **Breakdowns**:
  - Sentiment distribution
  - Channel performance (per‑channel sentiment + share of mentions)

---

## Getting started

### 1. Open locally (simplest)

1. Make sure you are in the project folder:
   ```bash
   cd d:\new_project
   ```
2. Open `index.html` in your browser (double‑click it in Explorer **or** drag it into a browser window).

That’s it — the dashboard should load with mock sentiment data.

### 2. Serve as a static site (optional)

You can use any static HTTP server, for example:

```bash
cd d:\new_project
npx serve .
```

Then open the printed URL (usually `http://localhost:3000`) in your browser.

---

## Plugging in your AI sentiment backend

All mock data lives in `app.js`.

1. **Locate the mock loader** in `app.js`:
   ```js
   function loadMockData() {
     // ...
     return mentions;
   }
   ```
2. **Replace it** with a call to your API, e.g.:
   ```js
   async function loadMockData() {
     const res = await fetch("https://your-api/brand-sentiment?brand=...");
     const json = await res.json();
     return json.mentions; // map to the Mention shape below
   }
   ```
3. Make sure each mention object matches this shape:
   ```ts
   type Mention = {
     id: string;
     brand: string;
     channel: "twitter" | "instagram" | "news" | "reviews";
     text: string;
     sentimentScore: number; // -1..1
     sentimentLabel: "positive" | "neutral" | "negative";
     timestamp: number; // Unix ms
     reach: number;
   };
   ```
4. (Optional) Use CORS or a proxy if your API is on a different domain.

Once wired, the existing UI (filters, KPIs, charts, feed) will automatically reflect your real‑time sentiment data.

---

## Customization ideas

- Add **authentication** and call a protected backend.
- Swap mock chart for a library like **Chart.js** or **ECharts**.
- Persist user filters (brand, range, channels) in **localStorage**.
- Add **export to CSV/PDF** alongside the JSON snapshot button already in the header.

