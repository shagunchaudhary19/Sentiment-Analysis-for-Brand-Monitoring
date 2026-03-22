// Simple, framework-free dashboard logic for AI-based brand sentiment monitoring.
// All data is mocked here – replace loadMockData() with your own API integration.

/**
 * @typedef {Object} Mention
 * @property {string} id
 * @property {string} brand
 * @property {string} channel - e.g. 'twitter' | 'instagram' | 'news' | 'reviews'
 * @property {string} text
 * @property {number} sentimentScore - -1 (very negative) to 1 (very positive)
 * @property {string} sentimentLabel - 'positive' | 'neutral' | 'negative'
 * @property {number} timestamp - Unix ms
 * @property {number} reach - impact metric (followers, views, etc.)
 */

function loadMockData() {
  // Local fallback if API is down
  return [
    {
      id: "fallback-1",
      brand: "Apple",
      channel: "twitter",
      text: "fallback: Loving the new MacBook Pro performance.",
      sentimentScore: 0.9,
      sentimentLabel: "positive",
      timestamp: Date.now() - 3600000,
      reach: 10000,
    }
  ];
}

async function fetchMentionsFromApi() {
  try {
    const res = await fetch("/api/mentions");
    if (!res.ok) {
      throw new Error("Bad status " + res.status);
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.mentions)) {
      throw new Error("Invalid payload shape");
    }
    return data.mentions;
  } catch (err) {
    console.warn("Falling back to local mock data:", err);
    return loadMockData();
  }
}

function uniqueBrands(mentions) {
  const set = new Set(mentions.map((m) => m.brand));
  return Array.from(set);
}

function filterByBrandAndRange(mentions, brand, range, channels) {
  const now = Date.now();
  const ranges = {
    "24h": 24,
    "7d": 24 * 7,
    "30d": 24 * 30,
  };
  const hoursBack = ranges[range] ?? 24;
  const minTimestamp = now - hoursBack * 60 * 60 * 1000;

  return mentions.filter((m) => {
    if (brand && m.brand !== brand) return false;
    if (m.timestamp < minTimestamp) return false;
    if (channels && channels.length && !channels.includes(m.channel)) {
      return false;
    }
    return true;
  });
}

function computeStats(mentions) {
  const total = mentions.length;
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let scoreSum = 0;
  let reachSum = 0;

  const byBucket = new Map(); // time bucket for chart

  for (const m of mentions) {
    scoreSum += m.sentimentScore;
    reachSum += m.reach;
    if (m.sentimentLabel === "positive") positive++;
    else if (m.sentimentLabel === "negative") negative++;
    else neutral++;

    const bucketKey = bucketTimestamp(m.timestamp);
    if (!byBucket.has(bucketKey)) {
      byBucket.set(bucketKey, { positive: 0, negative: 0 });
    }
    const bucket = byBucket.get(bucketKey);
    if (m.sentimentLabel === "positive") bucket.positive++;
    if (m.sentimentLabel === "negative") bucket.negative++;
  }

  const avgScore = total ? scoreSum / total : 0;
  const reachPerMention = total ? reachSum / total : 0;

  return {
    total,
    positive,
    neutral,
    negative,
    avgScore,
    reachPerMention,
    byBucket,
  };
}

function bucketTimestamp(ts) {
  const d = new Date(ts);
  const range = state?.dateRange || "24h";

  // 24h: hourly buckets, 7d/30d: daily buckets
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (range === "24h") {
    const hh = String(d.getHours()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:00`;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function formatBucketLabel(bucketKey) {
  const range = state?.dateRange || "24h";
  if (range === "24h") {
    // "YYYY-MM-DD HH:00" -> "HH:00"
    const parts = bucketKey.split(" ");
    return parts[1] || bucketKey;
  }
  // "YYYY-MM-DD" -> "MM/DD"
  const [yyyy, mm, dd] = bucketKey.split("-");
  if (!yyyy || !mm || !dd) return bucketKey;
  return `${mm}/${dd}`;
}

function formatRelativeTime(ts) {
  const diffMs = Date.now() - ts;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  if (diffSec < 45) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay === 1) return "yesterday";
  return `${diffDay} days ago`;
}

function sentimentLabelFromScore(score) {
  if (score > 0.2) return "Positive";
  if (score < -0.2) return "Negative";
  return "Neutral";
}

function sentimentColor(score) {
  if (score > 0.2) return "indigo";
  if (score < -0.2) return "rose";
  return "zinc";
}

function roundedPercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

// DOM hooks
const els = {
  brandSelect: document.getElementById("brand-select"),
  compareToggle: document.getElementById("compare-toggle"),
  compareSelect: document.getElementById("compare-select"),
  dateRangeToggle: document.getElementById("date-range-toggle"),
  brandPulse: document.getElementById("brand-sentiment-pulse"),
  kpiCards: document.getElementById("kpi-cards"),
  trendChart: document.getElementById("trend-chart"),
  mentionsList: document.getElementById("mentions-list"),
  mentionsCountPill: document.getElementById("mentions-count-pill"),
  sentimentDistribution: document.getElementById("sentiment-distribution"),
  channelBreakdown: document.getElementById("channel-breakdown"),
  themeToggle: document.getElementById("theme-toggle"),
  mentionsSearch: document.getElementById("mentions-search"),
  mentionsSort: document.getElementById("mentions-sort"),
  highImpactToggle: document.getElementById("high-impact-toggle"),
  mentionsPrev: document.getElementById("mentions-prev"),
  mentionsNext: document.getElementById("mentions-next"),
  mentionsPaginationLabel: document.getElementById("mentions-pagination-label"),
  chartTypeToggle: document.getElementById("chart-type-toggle"),
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebar-overlay"),
  openSidebarBtn: document.getElementById("open-sidebar"),
  closeSidebarBtn: document.getElementById("close-sidebar"),
  toastContainer: document.getElementById("toast-container"),
  trendChartCanvas: document.getElementById("trend-chart-canvas"),
  mentionDrawerOverlay: document.getElementById("mention-drawer-overlay"),
  mentionDrawer: document.getElementById("mention-drawer"),
  mentionDrawerClose: document.getElementById("mention-drawer-close"),
  mentionDrawerTitle: document.getElementById("mention-drawer-title"),
  mentionDrawerChannel: document.getElementById("mention-drawer-channel"),
  mentionDrawerTime: document.getElementById("mention-drawer-time"),
  mentionDrawerBrand: document.getElementById("mention-drawer-brand"),
  mentionDrawerText: document.getElementById("mention-drawer-text"),
  mentionDrawerSentiment: document.getElementById("mention-drawer-sentiment"),
  mentionDrawerReach: document.getElementById("mention-drawer-reach"),
  mentionDrawerUrl: document.getElementById("mention-drawer-url"),
  platformFilterBtns: document.getElementById("platform-filter-btns"),
  clearFiltersBtn: document.getElementById("clear-filters-btn"),
};

const state = {
  rawMentions: [],
  selectedBrand: null,
  isCompareMode: false,
  compareBrand: null,
  dateRange: "24h",
  // Supported sources for the UI
  channels: ["reddit", "youtube"],
  searchQuery: "",
  highImpactOnly: false,
  sort: "latest",
  page: 1,
  pageSize: 10,
  chartType: "bar",
  selectedMentionId: null,
  status: "loading", // loading | ready | error
  errorMessage: null,
  chartInstance: null,
};

const themeState = {
  current: "dark",
};

const SUPPORTED_PLATFORMS = ["instagram", "facebook", "reddit", "youtube"];
const LANDING_SOURCES_KEY = "brandSentiment.sources.v1";

function sanitizePlatforms(platforms) {
  const set = new Set(Array.isArray(platforms) ? platforms.map(String) : []);
  const filtered = SUPPORTED_PLATFORMS.filter((p) => set.has(p));
  return filtered.length ? filtered : ["reddit", "youtube"];
}

function loadLandingPlatforms() {
  try {
    const raw = localStorage.getItem(LANDING_SOURCES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return sanitizePlatforms(parsed);
  } catch {
    return null;
  }
}

async function init() {
  initTheme();

  hydrateUiControls();
  restoreFiltersFromStorage();
  await refreshMentions();

  hydrateBrandSelector(uniqueBrands(state.rawMentions));
  hydrateDateRangeToggle();
  hydrateMentionFilters();
  hydrateMobileMenu();
  hydrateMentionsUi();
  hydrateChartTypeToggle();
  hydrateMentionDrawer();
  hydratePlatformFilters();

  // Select first brand by default
  if (!state.selectedBrand && els.brandSelect && els.brandSelect.options.length > 0) {
    state.selectedBrand = els.brandSelect.value;
  }

  render();

  const liveAnalyzeBtn = document.getElementById("live-analyze-btn");
  if (liveAnalyzeBtn) {
    liveAnalyzeBtn.addEventListener("click", () => {
      executeLiveAnalysis();
    });
  }

  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportSnapshot();
    });
  }
}

async function executeLiveAnalysis() {
  const btn = document.getElementById("live-analyze-btn");
  if (!btn) return;

  if (!state.selectedBrand) {
    showToast("Please select a brand first", "info");
    return;
  }

  btn.disabled = true;

  // We'll prioritize the first active platform in the filter, or youtube as default
  const targetPlatform = state.channels.includes("youtube") ? "youtube" : state.channels[0] || "youtube";

  const platforms = ["youtube", "twitter", "tiktok", "instagram", "reddit"];

  // Show progress per platform to keep the high-end feel
  for (const p of platforms) {
    btn.innerHTML = `<i class="ph ph-circle-notch animate-spin"></i> Reading ${p}...`;
    await new Promise(r => setTimeout(r, 500 + Math.random() * 300));
  }

  btn.innerHTML = `<i class="ph ph-cpu animate-pulse"></i> Analyzing...`;

  try {
    const res = await fetch(`/api/fetch-live?brand=${encodeURIComponent(state.selectedBrand)}&platform=${targetPlatform}`);
    if (!res.ok) throw new Error("Sync failed");

    const data = await res.json();
    const newMention = data.mention;

    if (newMention) {
      state.rawMentions.unshift(newMention);
      showToast(`New ${newMention.brand} ${newMention.sourceType} found on ${newMention.channel}!`, "success");
    }
  } catch (err) {
    console.error("Live Sync Error:", err);
    showToast("Could not reach live sources. Try again later.", "error");
  }

  btn.disabled = false;
  btn.innerHTML = `<i class="ph ph-lightning text-purple-500"></i> Live Analyze`;

  render();
}

function hydratePlatformFilters() {
  if (!els.platformFilterBtns) return;

  // Clear filters
  if (els.clearFiltersBtn) {
    els.clearFiltersBtn.addEventListener("click", () => {
      state.channels = ["youtube", "twitter", "tiktok", "instagram", "reddit", "news", "reviews"];
      state.page = 1;
      persistFiltersToStorage();
      render();
    });
  }

  // Toggle individual platforms
  els.platformFilterBtns.querySelectorAll("[data-platform]").forEach(btn => {
    btn.addEventListener("click", () => {
      const platform = btn.getAttribute("data-platform");
      if (!platform) return;

      const index = state.channels.indexOf(platform);
      if (index > -1) {
        // Remove if multiple are selected, or if we want to allow 0 (though maybe keep at least 1?)
        if (state.channels.length > 1) {
          state.channels.splice(index, 1);
        } else {
          showToast("At least one platform must be active", "info");
          return;
        }
      } else {
        state.channels.push(platform);
      }

      state.page = 1;
      persistFiltersToStorage();
      render();
    });
  });
}

function hydrateUiControls() {
  // Normalize defaults into UI controls
  if (els.mentionsSort) els.mentionsSort.value = state.sort;
  if (els.highImpactToggle) els.highImpactToggle.checked = !!state.highImpactOnly;
  if (els.mentionsSearch) els.mentionsSearch.value = state.searchQuery || "";
}

async function refreshMentions() {
  state.status = "loading";
  state.errorMessage = null;
  render();
  try {
    const mentions = await fetchMentionsFromApi();
    state.rawMentions = Array.isArray(mentions) ? mentions : [];
    state.status = "ready";
  } catch (e) {
    state.status = "error";
    state.errorMessage = "Failed to load mentions.";
    showToast("Failed to load mentions", "info");
  }
  render();
}

function applyTheme(theme) {
  const root = document.documentElement;
  themeState.current = theme;
  if (theme === "dark") {
    root.classList.add("dark");
    root.dataset.theme = "dark";
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
  }
}

function updateThemeToggleUi(theme) {
  if (!els.themeToggle) return;
  const labelSpan = els.themeToggle.querySelector(".theme-label");
  if (labelSpan) {
    labelSpan.textContent = theme === "dark" ? "Dark" : "Light";
  }
}

function initTheme() {
  const stored = localStorage.getItem("theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial =
    stored === "light" || stored === "dark"
      ? stored
      : prefersDark
        ? "dark"
        : "light";

  applyTheme(initial);
  updateThemeToggleUi(initial);

  if (els.themeToggle) {
    els.themeToggle.addEventListener("click", () => {
      const next = themeState.current === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyTheme(next);
      updateThemeToggleUi(next);
      
      // Force chart to re-render with new theme colors
      if (state.chartInstance) {
        state.chartInstance.destroy();
        state.chartInstance = null;
        render();
      }
    });
  }
}

function hydrateBrandSelector(brands) {
  if (!els.brandSelect) return;
  els.brandSelect.innerHTML = "";
  if (els.compareSelect) els.compareSelect.innerHTML = `<option value="">Select competitor...</option>`;
  
  brands.forEach((brand) => {
    // Populate main select
    const opt = document.createElement("option");
    opt.value = brand;
    opt.textContent = brand;
    els.brandSelect.appendChild(opt);
    
    // Populate compare select
    if (els.compareSelect) {
      const cOpt = document.createElement("option");
      cOpt.value = brand;
      cOpt.textContent = brand;
      els.compareSelect.appendChild(cOpt);
    }
  });

  // Restore previously selected brand if present in list
  if (state.selectedBrand) {
    const exists = Array.from(els.brandSelect.options).some(
      (o) => o.value === state.selectedBrand
    );
    if (exists) els.brandSelect.value = state.selectedBrand;
  }
  if (state.compareBrand && els.compareSelect) {
    const exists = Array.from(els.compareSelect.options).some((o) => o.value === state.compareBrand);
    if (exists) els.compareSelect.value = state.compareBrand;
  }
  if (els.compareToggle) {
    els.compareToggle.checked = state.isCompareMode;
    if (els.compareSelect) els.compareSelect.disabled = !state.isCompareMode;
  }

  els.brandSelect.addEventListener("change", () => {
    state.selectedBrand = els.brandSelect.value || null;
    state.page = 1;
    persistFiltersToStorage();
    render();
  });
  
  if (els.compareToggle && els.compareSelect) {
    els.compareToggle.addEventListener("change", (e) => {
      state.isCompareMode = !!e.target.checked;
      els.compareSelect.disabled = !state.isCompareMode;
      persistFiltersToStorage();
      render();
    });
    
    els.compareSelect.addEventListener("change", () => {
      state.compareBrand = els.compareSelect.value || null;
      persistFiltersToStorage();
      render();
    });
  }
}

function hydrateDateRangeToggle() {
  if (!els.dateRangeToggle) return;
  els.dateRangeToggle.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const range = btn.getAttribute("data-range");
      if (!range) return;
      state.dateRange = range;
      state.page = 1;
      persistFiltersToStorage();

      // update active styles
      els.dateRangeToggle.querySelectorAll("button").forEach((b) => {
        if (b === btn) {
          b.classList.add(
            "bg-white",
            "dark:bg-zinc-800",
            "text-zinc-900",
            "dark:text-zinc-100",
            "shadow-sm",
            "dark:shadow-zinc-950/50"
          );
          b.classList.remove("text-zinc-600", "dark:text-zinc-400");
        } else {
          b.classList.remove(
            "bg-white",
            "dark:bg-zinc-800",
            "text-zinc-900",
            "dark:text-zinc-100",
            "shadow-sm",
            "dark:shadow-zinc-950/50"
          );
          b.classList.add("text-zinc-600", "dark:text-zinc-400");
        }
      });

      render();
    });
  });

  // Sync active styles to restored date range
  const activeBtn = Array.from(els.dateRangeToggle.querySelectorAll("button")).find(
    (b) => b.getAttribute("data-range") === state.dateRange
  );
  if (activeBtn) activeBtn.click();
}

function hydrateMentionFilters() {
  if (els.mentionsSearch) {
    els.mentionsSearch.addEventListener("input", (event) => {
      const value = event.target.value || "";
      state.searchQuery = value.toLowerCase().trim();
      state.page = 1;
      persistFiltersToStorage();
      render();
    });
  }

  if (els.highImpactToggle) {
    els.highImpactToggle.addEventListener("change", (event) => {
      state.highImpactOnly = !!event.target.checked;
      state.page = 1;
      persistFiltersToStorage();
      render();
    });
  }
}

function hydrateMentionsUi() {
  if (els.mentionsSort) {
    els.mentionsSort.addEventListener("change", (event) => {
      state.sort = event.target.value || "latest";
      state.page = 1;
      persistFiltersToStorage();
      render();
    });
  }

  if (els.mentionsPrev) {
    els.mentionsPrev.addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      render();
    });
  }
  if (els.mentionsNext) {
    els.mentionsNext.addEventListener("click", () => {
      state.page = state.page + 1;
      render();
    });
  }
}

function hydrateChartTypeToggle() {
  if (!els.chartTypeToggle) return;
  els.chartTypeToggle.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-chart");
      if (!next || (next !== "bar" && next !== "line")) return;
      state.chartType = next;
      updateChartTypeToggleUi();
      render();
    });
  });
  updateChartTypeToggleUi();
}

function updateChartTypeToggleUi() {
  if (!els.chartTypeToggle) return;
  const buttons = Array.from(els.chartTypeToggle.querySelectorAll("button"));
  buttons.forEach((b) => {
    const val = b.getAttribute("data-chart");
    const active = val === state.chartType;
    if (active) {
      b.classList.add(
        "bg-white",
        "dark:bg-zinc-800",
        "text-zinc-900",
        "dark:text-zinc-100",
        "shadow-sm",
        "dark:shadow-zinc-950/50",
        "font-medium"
      );
      b.classList.remove("text-zinc-600", "dark:text-zinc-400");
    } else {
      b.classList.remove(
        "bg-white",
        "dark:bg-zinc-800",
        "text-zinc-900",
        "dark:text-zinc-100",
        "shadow-sm",
        "dark:shadow-zinc-950/50",
        "font-medium"
      );
      b.classList.add("text-zinc-600", "dark:text-zinc-400");
    }
  });
}

function hydrateMentionDrawer() {
  const { mentionDrawerOverlay, mentionDrawer, mentionDrawerClose } = els;
  if (!mentionDrawerOverlay || !mentionDrawer || !mentionDrawerClose) return;

  function close() {
    mentionDrawer.classList.add("translate-x-full");
    mentionDrawerOverlay.classList.add("hidden");
    state.selectedMentionId = null;
  }

  mentionDrawerClose.addEventListener("click", close);
  mentionDrawerOverlay.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function openMentionDrawer(mention) {
  const { mentionDrawerOverlay, mentionDrawer } = els;
  if (!mentionDrawerOverlay || !mentionDrawer) return;
  mentionDrawerOverlay.classList.remove("hidden");
  mentionDrawer.classList.remove("translate-x-full");

  if (els.mentionDrawerTitle) {
    els.mentionDrawerTitle.textContent = mention?.sentimentLabel
      ? `${mention.sentimentLabel.toUpperCase()} mention`
      : "Mention details";
  }
  if (els.mentionDrawerChannel) els.mentionDrawerChannel.textContent = mention.channel || "source";
  if (els.mentionDrawerTime) els.mentionDrawerTime.textContent = formatRelativeTime(mention.timestamp);
  if (els.mentionDrawerBrand) els.mentionDrawerBrand.textContent = mention.brand || "Unattributed";
  if (els.mentionDrawerText) els.mentionDrawerText.textContent = mention.text || "";
  if (els.mentionDrawerSentiment) {
    els.mentionDrawerSentiment.textContent = `${sentimentLabelFromScore(mention.sentimentScore)} • ${mention.sentimentScore.toFixed(2)}`;
  }
  if (els.mentionDrawerReach) els.mentionDrawerReach.textContent = (mention.reach ?? 0).toLocaleString();
  if (els.mentionDrawerUrl) {
    if (mention.url) {
      els.mentionDrawerUrl.href = mention.url;
      els.mentionDrawerUrl.classList.remove("hidden");
    } else {
      els.mentionDrawerUrl.classList.add("hidden");
    }
  }
}

const STORAGE_KEY = "brandSentiment.filters.v1";
function persistFiltersToStorage() {
  try {
    const payload = {
      selectedBrand: state.selectedBrand,
      isCompareMode: state.isCompareMode,
      compareBrand: state.compareBrand,
      dateRange: state.dateRange,
      searchQuery: state.searchQuery,
      highImpactOnly: state.highImpactOnly,
      sort: state.sort,
      channels: state.channels,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function restoreFiltersFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.dateRange) state.dateRange = parsed.dateRange;
      if (typeof parsed.searchQuery === "string") state.searchQuery = parsed.searchQuery;
      if (typeof parsed.highImpactOnly === "boolean") state.highImpactOnly = parsed.highImpactOnly;
      if (typeof parsed.sort === "string") state.sort = parsed.sort;
      if (typeof parsed.selectedBrand === "string") state.selectedBrand = parsed.selectedBrand;
      if (typeof parsed.isCompareMode === "boolean") state.isCompareMode = parsed.isCompareMode;
      if (typeof parsed.compareBrand === "string") state.compareBrand = parsed.compareBrand;
      if (Array.isArray(parsed.channels)) state.channels = sanitizePlatforms(parsed.channels);
    }
    // If no stored channels, prefer the landing page selection.
    if (!state.channels || !state.channels.length) {
      const landing = loadLandingPlatforms();
      if (landing) state.channels = landing;
    }
    hydrateUiControls();
  } catch {
    // ignore
  }
}

function exportSnapshot() {
  const snapshot = buildSnapshot();
  const mentions = getMentionsView().pageItems;
  const enriched = {
    ...snapshot,
    exportedAt: new Date().toISOString(),
    sort: state.sort,
    searchQuery: state.searchQuery,
    highImpactOnly: state.highImpactOnly,
    page: state.page,
    pageSize: state.pageSize,
    visibleMentions: mentions,
  };
  const pretty = JSON.stringify(enriched, null, 2);
  const blob = new Blob([pretty], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brand-sentiment-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // CSV export as well
  const csv = mentionsToCsv(mentions);
  const csvBlob = new Blob([csv], { type: "text/csv" });
  const csvUrl = URL.createObjectURL(csvBlob);
  const b = document.createElement("a");
  b.href = csvUrl;
  b.download = `brand-sentiment-${Date.now()}.csv`;
  b.click();
  URL.revokeObjectURL(csvUrl);

  showToast("Snapshot exported (JSON + CSV)", "success");
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function mentionsToCsv(mentions) {
  const header = [
    "id",
    "brand",
    "channel",
    "text",
    "sentimentScore",
    "sentimentLabel",
    "timestamp",
    "reach",
  ];
  const rows = mentions.map((m) => [
    m.id,
    m.brand,
    m.channel,
    m.text,
    m.sentimentScore,
    m.sentimentLabel,
    m.timestamp,
    m.reach,
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function hydrateMobileMenu() {
  const { sidebar, sidebarOverlay, openSidebarBtn, closeSidebarBtn } = els;
  if (!sidebar || !sidebarOverlay || !openSidebarBtn || !closeSidebarBtn) return;

  function open() {
    sidebar.classList.remove("-translate-x-full");
    sidebarOverlay.classList.remove("hidden", "opacity-0");
  }

  function close() {
    sidebar.classList.add("-translate-x-full");
    sidebarOverlay.classList.add("opacity-0");
    setTimeout(() => {
      sidebarOverlay.classList.add("hidden");
    }, 300);
  }

  openSidebarBtn.addEventListener("click", open);
  closeSidebarBtn.addEventListener("click", close);
  sidebarOverlay.addEventListener("click", close);
}

function showToast(message, type = "info") {
  if (!els.toastContainer) return;

  const toast = document.createElement("div");
  const colors =
    type === "success"
      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
      : "bg-zinc-800 dark:bg-zinc-900 border-zinc-700 dark:border-zinc-700 text-zinc-200 dark:text-zinc-200";

  toast.className = `
    flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl transform translate-y-10 opacity-0 transition-all duration-300 ${colors}
  `;
  toast.innerHTML = `
    <i class="ph ${type === "success" ? "ph-check-circle" : "ph-info"
    } text-lg"></i>
    <span class="text-xs font-medium">${message}</span>
  `;

  els.toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-10", "opacity-0");
  });

  // Remove after delay
  setTimeout(() => {
    toast.classList.add("translate-y-10", "opacity-0");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function buildSnapshot() {
  const filtered = filterByBrandAndRange(
    state.rawMentions,
    state.selectedBrand,
    state.dateRange,
    state.channels
  );
  const stats = computeStats(filtered);
  return {
    brand: state.selectedBrand,
    dateRange: state.dateRange,
    channels: state.channels,
    totals: {
      mentions: stats.total,
      positive: stats.positive,
      neutral: stats.neutral,
      negative: stats.negative,
      avgScore: stats.avgScore,
    },
  };
}

function render() {
  if (state.status === "loading") {
    renderLoadingState();
    return;
  }

  if (state.status === "error") {
    renderErrorState(state.errorMessage || "Something went wrong.");
    return;
  }

  let filtered = filterByBrandAndRange(
    state.rawMentions,
    state.selectedBrand,
    state.dateRange,
    state.channels
  );
  filtered = applyAdditionalMentionFilters(filtered);
  const stats = computeStats(filtered);
  const view = getMentionsView(filtered);

  renderBrandPulse(stats);
  renderKpiCards(stats);
  renderTrendChart(stats);
  renderMentionsList(view);
  renderDistribution(stats);
  renderChannelBreakdown(filtered, stats.total);
  renderPlatformFilters();
}

function renderPlatformFilters() {
  if (!els.platformFilterBtns) return;
  els.platformFilterBtns.querySelectorAll("[data-platform]").forEach((btn) => {
    const platform = btn.getAttribute("data-platform");
    if (state.channels.includes(platform)) {
      btn.classList.add(
        "bg-indigo-50",
        "dark:bg-indigo-900/40",
        "border-indigo-300",
        "dark:border-indigo-700"
      );
      btn.classList.remove(
        "opacity-50",
        "bg-zinc-100",
        "dark:bg-zinc-900",
        "border-zinc-200",
        "dark:border-zinc-800"
      );
    } else {
      btn.classList.remove(
        "bg-indigo-50",
        "dark:bg-indigo-900/40",
        "border-indigo-300",
        "dark:border-indigo-700"
      );
      btn.classList.add(
        "opacity-50",
        "bg-zinc-100",
        "dark:bg-zinc-900",
        "border-zinc-200",
        "dark:border-zinc-800"
      );
    }
  });
}

function renderLoadingState() {
  if (els.kpiCards) {
    els.kpiCards.innerHTML = `
      ${Array.from({ length: 4 })
        .map(
          () => `
        <div data-card class="relative overflow-hidden rounded-xl border border-zinc-200/50 dark:border-white/5 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl px-4 py-3.5 flex flex-col gap-1.5 shadow-sm dark:shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
          <div class="h-3 w-24 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>
          <div class="mt-3 h-7 w-16 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>
          <div class="mt-2 h-3 w-40 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>
        </div>
      `
        )
        .join("")}
    `;
  }

  // Mentions skeleton list
  if (els.mentionsList) {
    els.mentionsList.innerHTML = `
      ${Array.from({ length: 6 })
        .map(
          () => `
        <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 px-3.5 py-3.5 shadow-sm dark:shadow-zinc-950/50">
          <div class="flex items-center justify-between">
            <div class="h-3 w-28 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>
            <div class="h-3 w-16 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>
          </div>
          <div class="mt-3 h-3 w-full bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>
          <div class="mt-2 h-3 w-4/5 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>
        </div>
      `
        )
        .join("")}
    `;
  }

  if (els.mentionsCountPill) els.mentionsCountPill.textContent = "Loading…";
  if (els.mentionsPaginationLabel) els.mentionsPaginationLabel.textContent = "Loading…";
  if (els.sentimentDistribution) {
    els.sentimentDistribution.innerHTML =
      '<div class="h-4 w-40 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>';
  }
  if (els.channelBreakdown) {
    els.channelBreakdown.innerHTML =
      '<div class="h-4 w-40 bg-zinc-200/70 dark:bg-zinc-800 rounded animate-pulse"></div>';
  }
}

function renderErrorState(message) {
  if (els.kpiCards) els.kpiCards.innerHTML = "";
  if (els.mentionsCountPill) els.mentionsCountPill.textContent = "—";
  if (els.mentionsList) {
    els.mentionsList.innerHTML = `
      <div class="rounded-xl border border-rose-500/20 bg-rose-50/80 dark:bg-rose-500/10 px-4 py-4 text-xs text-rose-800 dark:text-rose-200">
        ${message}
        <button id="retry-load" class="ml-2 underline underline-offset-2">Retry</button>
      </div>
    `;
    const retry = document.getElementById("retry-load");
    if (retry) retry.addEventListener("click", refreshMentions);
  }
  if (els.mentionsPaginationLabel) els.mentionsPaginationLabel.textContent = "";
}

function getMentionsView(mentions) {
  const sorted = mentions.slice();
  if (state.sort === "reach") {
    sorted.sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0));
  } else if (state.sort === "most_positive") {
    sorted.sort((a, b) => (b.sentimentScore ?? 0) - (a.sentimentScore ?? 0));
  } else if (state.sort === "most_negative") {
    sorted.sort((a, b) => (a.sentimentScore ?? 0) - (b.sentimentScore ?? 0));
  } else {
    sorted.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }

  const total = sorted.length;
  const pageSize = state.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, state.page), totalPages);
  state.page = page;

  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = sorted.slice(startIdx, endIdx);

  return { total, page, pageSize, totalPages, startIdx, endIdx, pageItems };
}

function applyAdditionalMentionFilters(mentions) {
  return mentions.filter((m) => {
    if (state.highImpactOnly && m.reach < 10000) {
      return false;
    }
    if (state.searchQuery) {
      const q = state.searchQuery;
      const text = (m.text || "").toLowerCase();
      const channel = (m.channel || "").toLowerCase();
      if (!text.includes(q) && !channel.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function renderBrandPulse(stats) {
  if (!els.brandPulse) return;
  const score = stats.avgScore || 0;
  const label = sentimentLabelFromScore(score);
  const color = sentimentColor(score);

  const dot = els.brandPulse.querySelector("span");
  const textNode = els.brandPulse.querySelectorAll("span")[1];

  if (dot) {
    dot.className =
      "inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-" +
      (color === "indigo"
        ? "indigo-500"
        : color === "rose"
          ? "rose-500"
          : "zinc-400");
  }
  if (textNode) {
    textNode.textContent = `${label} • ${score.toFixed(2)}`;
  }
}

function renderKpiCards(stats) {
  if (!els.kpiCards) return;
  const { total, positive, neutral, negative, avgScore, reachPerMention } =
    stats;

  const sentimentScoreText = avgScore > 0 ? "text-indigo-600 dark:text-indigo-400" : avgScore < 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-600 dark:text-zinc-400";

  const competitorStats = state.isCompareMode && state.compareBrand
    ? computeStats(filterByBrandAndRange(state.rawMentions, state.compareBrand, state.dateRange, state.channels))
    : null;
  const benchmarkScore = competitorStats ? competitorStats.avgScore.toFixed(2) : "0.12";

  // AI Insights Logic
  const insightsPanel = document.getElementById("ai-insights-panel");
  const insightsList = document.getElementById("ai-insights-list");
  if (insightsPanel && insightsList) {
    if (total > 0) {
      insightsPanel.classList.remove("hidden");
      const sentimentTrend = avgScore > 0.3 ? "dominantly positive" : avgScore < -0.3 ? "critically negative" : "largely neutral";
      const topPlatform = stats.byPlatform && stats.byPlatform.size > 0 ? Array.from(stats.byPlatform.keys())[0] : "All Platforms";
      insightsList.innerHTML = `
        <li>Overall sentiment for <b>${state.selectedBrand}</b> is <b>${sentimentTrend}</b>.</li>
        <li>The primary driver of discussion is concentrated on <b>${topPlatform}</b>.</li>
        ${total > 5 ? `<li>AI recommends <b>${avgScore < 0 ? 'Urgent Engagement' : 'Amplification'}</b> based on current volume of ${total} mentions.</li>` : ''}
        ${competitorStats ? `<li>Comparing against <b>${state.compareBrand}</b>: they currently stand at a sentiment score of ${benchmarkScore}. <b>${avgScore >= competitorStats.avgScore ? 'You are leading.' : 'They are leading.'}</b></li>` : ''}
      `;
    } else {
      insightsPanel.classList.add("hidden");
    }
  }

  els.kpiCards.innerHTML = `
    <div data-card class="relative overflow-hidden rounded-xl border border-zinc-200/50 dark:border-white/5 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl px-4 py-3.5 flex flex-col gap-1.5 shadow-sm dark:shadow-[0_8px_16px_rgba(0,0,0,0.4)] transition-all">
      <div class="absolute -right-4 -top-4 w-16 h-16 bg-zinc-300/20 dark:bg-zinc-800/30 rounded-full blur-2xl"></div>
      <p class="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.18em]">Total mentions</p>
      <p class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">${total}</p>
      <p class="text-[11px] text-zinc-500 dark:text-zinc-500">Across all sources & range</p>
    </div>
    <div data-card class="relative overflow-hidden rounded-xl border border-indigo-500/20 dark:border-indigo-400/10 bg-indigo-50/50 dark:bg-indigo-900/10 backdrop-blur-xl px-4 py-3.5 flex flex-col gap-1.5 shadow-sm dark:shadow-[0_8px_16px_rgba(0,0,0,0.4)] transition-all">
      <div class="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-2xl"></div>
      <div class="flex items-center justify-between">
        <p class="text-[10px] font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-[0.18em]">Sentiment score</p>
        ${state.isCompareMode && state.compareBrand ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">VS ${state.compareBrand}</span>` : ''}
      </div>
      <p class="text-2xl font-bold ${sentimentScoreText}">${avgScore.toFixed(2)}</p>
      <p class="text-[11px] text-indigo-600/90 dark:text-indigo-400/80">
        ${state.isCompareMode && state.compareBrand ? `Benchmark: <span class="font-bold">${benchmarkScore}</span> avg` : 'Higher is more positive'}
      </p>
    </div>
    <div data-card class="relative overflow-hidden rounded-xl border border-purple-500/20 dark:border-purple-400/10 bg-purple-50/50 dark:bg-purple-900/10 backdrop-blur-xl px-4 py-3.5 flex flex-col gap-1.5 shadow-sm dark:shadow-[0_8px_16px_rgba(0,0,0,0.4)] transition-all">
      <div class="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-2xl"></div>
      <p class="text-[10px] font-medium text-purple-700 dark:text-purple-400 uppercase tracking-[0.18em]">Sentiment split</p>
      <div class="flex items-baseline gap-3 text-xs">
        <span class="text-indigo-600 dark:text-indigo-400">${roundedPercent(positive, total)}% <span class="text-zinc-500 dark:text-zinc-500">pos</span></span>
        <span class="text-zinc-600 dark:text-zinc-400">${roundedPercent(neutral, total)}% <span class="text-zinc-500 dark:text-zinc-500">neutral</span></span>
        <span class="text-rose-600 dark:text-rose-400">${roundedPercent(negative, total)}% <span class="text-zinc-500 dark:text-zinc-500">neg</span></span>
      </div>
      <div class="mt-1.5 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800/60 overflow-hidden flex border border-zinc-300/30 dark:border-zinc-700/50 shadow-inner">
        <div style="width:${roundedPercent(positive, total)}%;" class="bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-l-full shadow-[0_0_10px_rgba(20,184,166,0.5)]"></div>
        <div style="width:${roundedPercent(neutral, total)}%;" class="bg-zinc-300 dark:bg-zinc-700"></div>
        <div style="width:${roundedPercent(negative, total)}%;" class="bg-gradient-to-r from-rose-400 to-rose-500 rounded-r-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
      </div>
    </div>
    <div data-card class="relative overflow-hidden rounded-xl border border-zinc-200/50 dark:border-white/5 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl px-4 py-3.5 flex flex-col gap-1.5 shadow-sm dark:shadow-[0_8px_16px_rgba(0,0,0,0.4)] transition-all">
      <div class="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 dark:bg-indigo-500/10 rounded-full blur-2xl"></div>
      <p class="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.18em]">Avg reach</p>
      <p class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">${Math.round(reachPerMention).toLocaleString()}</p>
      <p class="text-[11px] text-zinc-500 dark:text-zinc-500">Avg. impact per mention</p>
    </div>
  `;
}

function renderTrendChart(stats) {
  if (!els.trendChartCanvas) return;

  const entries = Array.from(stats.byBucket.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  );

  const labels = entries.map(([k]) => formatBucketLabel(k));
  const posData = entries.map(([, v]) => v.positive);
  const negData = entries.map(([, v]) => v.negative);

  if (state.chartInstance) {
    // If chart type changed, rebuild
    if (state.chartInstance.config.type !== state.chartType) {
      state.chartInstance.destroy();
      state.chartInstance = null;
      return renderTrendChart(stats);
    }
    state.chartInstance.data.labels = labels;
    state.chartInstance.data.datasets[0].data = posData;
    state.chartInstance.data.datasets[1].data = negData;
    state.chartInstance.update();
  } else {
    // Check if Chart is loaded
    if (typeof Chart === "undefined") return;

    const isDark = themeState.current === "dark";
    const gridColor = isDark ? "#27272a" : "#e5e7eb";
    const tickColor = isDark ? "#71717a" : "#78716c";
    const tooltipBg = isDark ? "#18181b" : "#ffffff";
    const tooltipTitle = isDark ? "#a1a1aa" : "#57534e";
    const tooltipBody = isDark ? "#fafafa" : "#1c1917";
    const tooltipBorder = isDark ? "#27272a" : "#e5e7eb";

    state.chartInstance = new Chart(els.trendChartCanvas, {
      type: state.chartType,
      data: {
        labels,
        datasets: [
          {
            label: "Positive",
            data: posData,
            backgroundColor: "#6366f1", // indigo-500
            borderColor: "#6366f1",
            tension: 0.35,
            borderRadius: 4,
            barThickness: 12,
            pointRadius: state.chartType === "line" ? 2 : 0,
            pointHoverRadius: state.chartType === "line" ? 4 : 0,
            fill: false,
          },
          {
            label: "Negative",
            data: negData,
            backgroundColor: "#f43f5e", // rose-500
            borderColor: "#f43f5e",
            tension: 0.35,
            borderRadius: 4,
            barThickness: 12,
            pointRadius: state.chartType === "line" ? 2 : 0,
            pointHoverRadius: state.chartType === "line" ? 4 : 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: tooltipBody,
            borderColor: tooltipBorder,
            borderWidth: 1,
            padding: 10,
            displayColors: true,
            boxPadding: 4,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 10 } },
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 10 } },
            beginAtZero: true,
          },
        },
        interaction: {
          mode: "nearest",
          axis: "x",
          intersect: false,
        },
      },
    });
  }
}

function renderMentionsList(view) {
  if (!els.mentionsList || !els.mentionsCountPill) return;
  const { total, page, totalPages, startIdx, endIdx, pageItems } = view;
  els.mentionsCountPill.textContent =
    total === 1 ? "1 mention" : `${total} mentions`;

  if (els.mentionsPaginationLabel) {
    els.mentionsPaginationLabel.textContent =
      total === 0 ? "Showing 0–0" : `Showing ${startIdx + 1}–${endIdx}`;
  }
  if (els.mentionsPrev) els.mentionsPrev.disabled = page <= 1;
  if (els.mentionsNext) els.mentionsNext.disabled = page >= totalPages;

  if (!total) {
    els.mentionsList.innerHTML =
      '<div class="text-xs text-zinc-500 dark:text-zinc-500 py-4 text-center">No mentions for this selection yet.</div>';
    return;
  }

  const channelStyles = {
    twitter: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
    instagram: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/25",
    youtube: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
    tiktok: "bg-zinc-950/10 text-zinc-900 dark:text-zinc-100 border-zinc-950/25",
    reddit: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25",
    news: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25",
    reviews: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
    news_rss: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  };

  const sourceTypeIcons = {
    video: "ph ph-video-camera",
    comment: "ph ph-chats-teardrop",
    post: "ph ph-article",
    review: "ph ph-star-half",
    article: "ph ph-newspaper",
  };

  els.mentionsList.innerHTML = pageItems
    .map((m) => {
      const color = sentimentColor(m.sentimentScore);
      const borderColor =
        color === "indigo"
          ? "border-indigo-500/25"
          : color === "rose"
            ? "border-rose-500/25"
            : "border-zinc-600/70 dark:border-zinc-700/70";
      const badgeColor =
        color === "indigo"
          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          : color === "rose"
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400";

      const channelClass =
        channelStyles[m.channel] ||
        "bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700";

      const sourceIcon = sourceTypeIcons[m.sourceType] || "ph ph-globe";
      const author = m.author ? `<span class="font-medium text-zinc-700 dark:text-zinc-300">@${m.author}</span>` : "";

      return `
        <button type="button" data-mention-id="${m.id}"
          class="w-full text-left rounded-xl border ${borderColor} bg-white/70 dark:bg-zinc-900/50 backdrop-blur-sm px-3.5 py-3.5 shadow-sm dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)] flex flex-col gap-2 hover:border-zinc-300 dark:hover:border-zinc-500 transition-all hover:translate-y-[-1px]">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span class="rounded-md px-2 py-0.5 border ${channelClass} flex items-center gap-1 shadow-sm">
                <i class="${sourceIcon}"></i>
                ${m.channel} ${m.sourceType ? `• ${m.sourceType}` : ""}
              </span>
              <span class="text-[10px] text-zinc-400 dark:text-zinc-500">
                ${formatRelativeTime(m.timestamp)}
              </span>
            </div>
            <span class="rounded-md px-2 py-0.5 text-[10px] font-medium ${badgeColor}">
              ${(m.sentimentLabel ?? "").toUpperCase()}
            </span>
          </div>
          <div class="flex flex-col gap-1">
            ${author}
            <p class="text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed">
              ${m.text}
            </p>
          </div>
          <div class="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-500">
            <span>Reach: ${m.reach.toLocaleString()}</span>
            <span>AI Score: ${m.sentimentScore.toFixed(2)}</span>
          </div>
        </button>
      `;
    })
    .join("");

  // Click delegation for opening drawer
  els.mentionsList.querySelectorAll("[data-mention-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-mention-id");
      const mention = state.rawMentions.find((m) => String(m.id) === String(id));
      if (!mention) return;
      state.selectedMentionId = id;
      openMentionDrawer(mention);
    });
  });
}

function renderDistribution(stats) {
  if (!els.sentimentDistribution) return;
  const { total, positive, neutral, negative } = stats;

  els.sentimentDistribution.innerHTML = `
    <h4 class="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 mb-1.5">Sentiment distribution</h4>
    <p class="text-[11px] text-indigo-700/90 dark:text-indigo-400/80 mb-3">
      ${total ? "Share of mentions by sentiment." : "No data in this range."}
    </p>
    <div class="space-y-2.5">
      <div class="flex items-center justify-between gap-2 text-[11px]">
        <span class="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <span class="h-2 w-2 rounded-full bg-indigo-500"></span>
          Positive
        </span>
        <span class="text-indigo-600 dark:text-indigo-400 font-medium">${positive} • ${roundedPercent(positive, total)}%</span>
      </div>
      <div class="flex items-center justify-between gap-2 text-[11px]">
        <span class="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <span class="h-2 w-2 rounded-full bg-zinc-400"></span>
          Neutral
        </span>
        <span class="text-zinc-600 dark:text-zinc-400 font-medium">${neutral} • ${roundedPercent(neutral, total)}%</span>
      </div>
      <div class="flex items-center justify-between gap-2 text-[11px]">
        <span class="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <span class="h-2 w-2 rounded-full bg-rose-500"></span>
          Negative
        </span>
        <span class="text-rose-600 dark:text-rose-400 font-medium">${negative} • ${roundedPercent(negative, total)}%</span>
      </div>
    </div>
  `;
}

function renderChannelBreakdown(mentions, total) {
  if (!els.channelBreakdown) return;
  const byChannel = new Map();
  for (const m of mentions) {
    if (!byChannel.has(m.channel)) {
      byChannel.set(m.channel, { count: 0, scoreSum: 0 });
    }
    const entry = byChannel.get(m.channel);
    entry.count++;
    entry.scoreSum += m.sentimentScore;
  }

  if (!byChannel.size) {
    els.channelBreakdown.innerHTML = `
      <h4 class="text-[11px] font-semibold text-purple-800 dark:text-purple-300 mb-1.5">Channel performance</h4>
      <p class="text-[11px] text-purple-700/90 dark:text-purple-400/80">No active channels for this selection.</p>
    `;
    return;
  }

  const rows = Array.from(byChannel.entries())
    .map(([channel, { count, scoreSum }]) => {
      const avg = count ? scoreSum / count : 0;
      const label = sentimentLabelFromScore(avg);
      const color = sentimentColor(avg);
      const textColor =
        color === "indigo"
          ? "text-indigo-600 dark:text-indigo-400"
          : color === "rose"
            ? "text-rose-600 dark:text-rose-400"
            : "text-zinc-600 dark:text-zinc-400";
      return `
        <div class="flex items-center justify-between text-[11px] py-1.5">
          <div class="flex flex-col">
            <span class="capitalize text-zinc-800 dark:text-zinc-200 font-medium">${channel}</span>
            <span class="text-[10px] text-zinc-500 dark:text-zinc-500">${count} mentions • ${roundedPercent(count, total || count)}% share</span>
          </div>
          <div class="text-right">
            <p class="${textColor} font-medium">${label}</p>
            <p class="text-[10px] text-zinc-500 dark:text-zinc-500">${avg.toFixed(2)} score</p>
          </div>
        </div>
      `;
    })
    .join("");

  els.channelBreakdown.innerHTML = `
    <h4 class="text-[11px] font-semibold text-purple-800 dark:text-purple-300 mb-1.5">Channel performance</h4>
    <p class="text-[11px] text-purple-700/90 dark:text-purple-400/80 mb-2">Which channels drive the strongest sentiment.</p>
    <div class="divide-y divide-zinc-200 dark:divide-zinc-700">
      ${rows}
    </div>
  `;
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

