# 🪐 BrandWatch Intelligence Platform: Master Manifest

This document serves as the single source of truth for the **BrandWatch SaaS Platform**, detailing the technical architecture, data state, and operational capabilities of the system.

## 🏗️ 1. Technical Architecture

The platform follows a modern decoupled architecture designed for high-performance sentiment intelligence.

| Component | Responsibility | Technology Stack |
| :--- | :--- | :--- |
| **Edge Server** | Authentication, API Hosting, Static Assets | Node.js, Express, JWT |
| **Neural Core** | Sentiment Analysis & Topic Extraction | VADER, Transformers (DistilBERT), Python |
| **Data Vault** | Persistent Brand & Mention Storage | SQLite 3 |
| **Visual Layer** | Modern Glassmorphic Dashboard & Real-time Charts | Tailwind CSS, JavaScript (Vanilla), Chart.js |

---

## 📡 2. API Surface Documentation

### Authentication (Non-Restricted)
- `POST /api/auth/signup`: Create a new SaaS account.
- `POST /api/auth/login`: Authenticate and receive a secure HTTP-Only JWT cookie.
- `POST /api/auth/logout`: Clear session tokens.

### Intelligence & Data (Authenticated)
- `GET /api/brands`: Retrieve all brands tracked by the current user.
- `POST /api/brands`: Initiate tracking for a new brand keyword.
- `GET /api/mentions`: Multi-platform mention stream (Reddit, YouTube, News, etc.).
- `POST /api/ai/insights`: Generate high-level strategic intelligence (GPT-4 or Local).
- `PUT /api/user/profile`: Personalize user display settings.

---

## 📊 3. Data Schema & Persistence

### `mentions` Table
Contains normalized data from multi-channel streams.
- `brand` (TEXT): The tracked brand key (e.g., "Antigravity").
- `vader_score` (REAL): Sentiment intensity (-1.0 to 1.0).
- `reach` (INTEGER): Estimated impressions/impact.
- `ai_summary` (TEXT): Human-readable synthesis or ML topics.

### `tracked_brands` Table
- `user_id` (INTEGER): Ownership link.
- `brand_name` (TEXT): Core keyword.

---

## 🚀 4. System Intelligence Highlights
The platform is currently optimized for high-fidelity brand monitoring:

- **Hybrid Sentiment**: Combines high-speed lexical analysis (VADER) with deep-context Transformers.
- **Strategic AI Synthesis**: Multi-stage report generation with GPT-4 fallback.
- **Platform Pulse Heatmap**: Real-time cross-channel activity visualization.
- **Live Monitor**: Automated 60s synchronization cycle for critical monitoring.
- **Onboarding Tour**: In-app guided walkthrough for first-time stakeholders.

---

## 🛠️ 5. Deployment & Launch
- **Server**: `node server.js`
- **Dashboard**: `http://localhost:4001`
- **ML Processor**: `python main.py` (to ingest new data)
- **Environment**: See `.env.example` to plug in OpenAI API Keys for premium features.

**System Status**: 🟢 PRODUCTION READY
**Database Path**: `./database/mentions.db`
