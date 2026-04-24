/**
 * BrandWatch Dashboard Logic
 * Handles Authentication, Real-time Mentions, AI Insights, and Data Visualization.
 */

const state = {
    user: null,
    rawMentions: [],
    selectedBrand: null,
    dateRange: "24h",
    channels: ["youtube", "twitter", "tiktok", "instagram", "reddit"],
    sort: "latest",
    page: 1,
    pageSize: 10,
    status: "loading",
    chartType: "bar",
    activeSection: "overview"
};

const els = {
    brandSelect: document.getElementById("brand-select"),
    kpiCards: document.getElementById("kpi-cards"),
    mentionsList: document.getElementById("mentions-list"),
    aiAnalyzeBtn: document.getElementById("ai-brain-btn"),
    aiInsightBanner: document.getElementById("ai-banner"),
    aiInsightBannerText: document.getElementById("ai-banner-text"),
    liveSyncBtn: document.getElementById("live-sync-btn"),
    addBrandBtn: document.getElementById("add-brand-btn"),
    userName: document.getElementById("user-name"),
    userAvatar: document.getElementById("user-avatar"),
    dateRangeToggle: document.getElementById("date-range-toggle"),
    mentionsSearch: document.getElementById("mentions-search"),
    mentionsSort: document.getElementById("mentions-sort"),
    mentionsPrev: document.getElementById("mentions-prev"),
    mentionsNext: document.getElementById("mentions-next"),
    mentionsPaginationLabel: document.getElementById("mentions-pagination"),
    chartTypeToggle: document.getElementById("chart-type-toggle"),
    toastContainer: document.getElementById("toast-container"),
    pageTitle: document.getElementById("page-title"),
    pageSub: document.getElementById("page-sub"),
    onboardModal: document.getElementById("brand-onboard-modal"),
    onboardInput: document.getElementById("onboard-brand-input"),
    onboardSearchBtn: document.getElementById("onboard-search-btn"),
    onboardSearching: document.getElementById("onboard-searching"),
    onboardResult: document.getElementById("onboard-result"),
    onboardLogo: document.getElementById("onboard-logo"),
    onboardBrandName: document.getElementById("onboard-brand-name"),
    onboardConfirmBtn: document.getElementById("onboard-confirm-btn"),
    onboardError: document.getElementById("onboard-error"),
    onboardRecs: document.getElementById("onboard-recommendations"),
    distLegend: document.getElementById("dist-legend"),
    settingsBtn: document.getElementById("settings-btn"),
    settingsModal: document.getElementById("settings-modal")
};

let sentimentChart = null;
let distributionChart = null;

async function init() {
    state.user = await checkAuth();
    if (!state.user) return;

    if (els.userName) els.userName.textContent = state.user.name || state.user.email;
    if (els.userAvatar) els.userAvatar.textContent = (state.user.name || state.user.email)[0].toUpperCase();

    // Parallelize data fetching for faster initial load
    await Promise.all([
        refreshBrands(),
        refreshMentions(),
        refreshCrisis(),
        refreshCompetitors(),
        refreshTrends()
    ]);
    
    render();
    setupListeners();
}

async function checkAuth() {
    try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
            window.location.href = "/login";
            return null;
        }
        const data = await res.json();
        return data.user;
    } catch (err) {
        window.location.href = "/login";
        return null;
    }
}

async function refreshBrands() {
    try {
        const res = await fetch("/api/brands");
        const data = await res.json();
        if (data.brands && els.brandSelect) {
            // Add "All Brands" option at the top
            els.brandSelect.innerHTML = `<option value="All Brands">All Brands</option>` + 
                data.brands.map(b => `<option value="${b.brand_name}">${b.brand_name}</option>`).join("");
            
            if (!state.selectedBrand) {
                state.selectedBrand = "All Brands";
                els.brandSelect.value = "All Brands";
            }
        }
        
        // Render the brand sliding bar if it exists
        renderBrandSidebar(data.brands || []);
    } catch (err) {
        console.error("Failed to load brands", err);
    }
}

function renderBrandSidebar(brands) {
    const sidebar = document.getElementById("brand-sidebar");
    if (!sidebar) return;
    
    const colors = ["#4F46E5", "#10B981", "#F43F5E", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];
    
    sidebar.innerHTML = `
        <button onclick="selectBrand('All Brands')" class="w-10 h-10 rounded-xl flex items-center justify-center transition-all ${state.selectedBrand === 'All Brands' ? 'bg-indigo-600 shadow-lg shadow-indigo-200 scale-110 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-400'}">
            <i data-lucide="layout-grid" class="w-4 h-4"></i>
        </button>
        ${brands.map((b, i) => `
            <button onclick="selectBrand('${b.brand_name}')" class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-[10px] transition-all relative group ${state.selectedBrand === b.brand_name ? 'scale-110 shadow-lg' : 'hover:scale-105'}" style="background:${colors[i % colors.length]}">
                ${b.brand_name[0]}
                ${state.selectedBrand === b.brand_name ? `<div class="absolute -bottom-1 w-1 h-1 bg-white rounded-full"></div>` : ''}
                <div class="absolute left-14 px-2 py-1 bg-slate-900 text-[9px] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">${b.brand_name}</div>
            </button>
        `).join("")}
    `;
    lucide.createIcons();
}

window.selectBrand = function(name) {
    state.selectedBrand = name;
    els.brandSelect.value = name;
    init(); // Refresh everything
};

async function refreshMentions() {
    state.status = "loading";
    try {
        const url = state.selectedBrand ? `/api/mentions?brand=${encodeURIComponent(state.selectedBrand)}` : "/api/mentions";
        const res = await fetch(url);
        const data = await res.json();
        state.rawMentions = data.mentions || [];
        processMentionsByThreshold();
        state.status = "ready";
    } catch (err) {
        state.status = "error";
        console.error("Failed to load mentions", err);
    }
}

async function refreshCrisis() {
    try {
        const query = state.selectedBrand && state.selectedBrand !== "All Brands" ? `?brand=${encodeURIComponent(state.selectedBrand)}` : "";
        const res = await fetch(`/api/alerts/crisis${query}`);
        const data = await res.json();
        renderCrisis(data.alerts || []);
        
        // Also fetch high-risk mentions for the radar
        const hrRes = await fetch(`/api/alerts/high-risk-mentions${query}`);
        const hrData = await hrRes.json();
        renderHighRiskMentions(hrData.mentions || []);

        const badge = document.getElementById("crisis-badge");
        if (badge) {
            const count = data.alerts ? data.alerts.length : 0;
            badge.textContent = count;
            badge.classList.toggle("hidden", count === 0);
        }
    } catch (err) {
        console.error("Failed to load crisis alerts", err);
    }
}

function renderHighRiskMentions(mentions) {
    const list = document.getElementById("high-risk-list");
    if (!list) return;
    
    list.innerHTML = mentions.length ? mentions.map(m => `
        <div class="p-5 bg-white border border-slate-100 rounded-[1.5rem] flex items-center justify-between group hover:shadow-lg hover:shadow-slate-200/50 transition-all cursor-pointer" onclick='openMentionDrawer(${JSON.stringify(m).replace(/'/g, "&apos;")})'>
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                    <i data-lucide="alert-triangle" class="w-5 h-5"></i>
                </div>
                <div>
                    <p class="text-[11px] font-black text-slate-900">${m.author}</p>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${m.channel} • Risk ${m.crisis_score}%</p>
                </div>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-all"></i>
        </div>
    `).join("") : '<p class="text-[10px] text-slate-400 italic p-8 text-center font-bold uppercase tracking-widest">No high-risk vectors detected.</p>';
    lucide.createIcons();
}

async function refreshCompetitors() {
    try {
        const url = state.selectedBrand ? `/api/analytics/competitors?brand=${encodeURIComponent(state.selectedBrand)}` : "/api/analytics/competitors";
        const res = await fetch(url);
        const data = await res.json();
        renderCompetitors(data);
    } catch (err) {
        console.error("Failed to load competitors", err);
    }
}

async function refreshTrends() {
    try {
        const url = state.selectedBrand ? `/api/analytics/trending?brand=${encodeURIComponent(state.selectedBrand)}` : "/api/analytics/trending";
        const res = await fetch(url);
        const data = await res.json();
        renderTrends(data.trending || []);
    } catch (err) {
        console.error("Failed to load trends", err);
    }
}

function setupListeners() {
    els.brandSelect?.addEventListener("change", async (e) => {
        state.selectedBrand = e.target.value;
        await refreshMentions();
        await refreshCrisis();
        await refreshCompetitors();
        await refreshTrends();
        render();
    });

    els.dateRangeToggle?.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            state.dateRange = btn.getAttribute("data-range");
            els.dateRangeToggle.querySelectorAll("button").forEach(b => {
                b.classList.remove("bg-indigo-600", "text-white");
                b.classList.add("text-slate-400");
            });
            btn.classList.remove("text-slate-400");
            btn.classList.add("bg-indigo-600", "text-white");
            render();
        });
    });

    els.addBrandBtn?.addEventListener("click", () => {
        els.onboardModal.classList.remove("hidden");
        els.onboardInput.focus();
    });

    document.getElementById("brand-onboard-close")?.addEventListener("click", () => els.onboardModal.classList.add("hidden"));
    document.getElementById("brand-onboard-close-overlay")?.addEventListener("click", () => els.onboardModal.classList.add("hidden"));

    els.onboardSearchBtn?.addEventListener("click", handleBrandSearch);
    els.onboardInput?.addEventListener("keypress", (e) => e.key === "Enter" && handleBrandSearch());
    els.onboardConfirmBtn?.addEventListener("click", executeOnboardingSync);

    els.aiAnalyzeBtn?.addEventListener("click", openBrainModal);
    els.liveSyncBtn?.addEventListener("click", executeLiveSync);

    els.mentionsSearch?.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        state.page = 1;
        render();
    });

    els.mentionsSort?.addEventListener("change", (e) => {
        state.sort = e.target.value;
        render();
    });

    els.mentionsPrev?.addEventListener("click", () => {
        if (state.page > 1) {
            state.page--;
            render();
        }
    });

    els.mentionsNext?.addEventListener("click", () => {
        const filtered = getFilteredMentions();
        if (state.page < Math.ceil(filtered.length / state.pageSize)) {
            state.page++;
            render();
        }
    });

    els.chartTypeToggle?.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            state.chartType = btn.getAttribute("data-chart");
            els.chartTypeToggle.querySelectorAll("button").forEach(b => {
                b.classList.remove("bg-white/10", "text-white");
                b.classList.add("text-slate-400");
            });
            btn.classList.remove("text-slate-400");
            btn.classList.add("bg-white/10", "text-white");
            render();
        });
    });

    // Navigation logic
    const navItems = ["overview", "mentions", "crisis", "competitors", "trends"];
    navItems.forEach(item => {
        const el = document.getElementById(`nav-${item}`);
        if (el) {
            el.addEventListener("click", () => {
                state.activeSection = item;
                navItems.forEach(i => document.getElementById(`nav-${i}`)?.classList.remove("active"));
                el.classList.add("active");
                
                // Hide all sections
                document.getElementById("kpi-cards")?.classList.toggle("hidden", item !== "overview");
                document.getElementById("overview-charts-1")?.classList.toggle("hidden", item !== "overview");
                document.getElementById("overview-charts-2")?.classList.toggle("hidden", item !== "overview");
                
                document.getElementById("section-mentions")?.classList.toggle("hidden", item !== "mentions");
                document.getElementById("section-crisis")?.classList.toggle("hidden", item !== "crisis");
                document.getElementById("section-competitors")?.classList.toggle("hidden", item !== "competitors");
                document.getElementById("section-trends")?.classList.toggle("hidden", item !== "trends");
                
                // Update titles
                const titles = {
                    overview: ["Brand Intelligence Overview", "Real-time NLP Analysis Engine"],
                    mentions: ["Mentions Feed", "Detailed data stream from 8 channels"],
                    crisis: ["Crisis Radar", "Active reputation risk monitoring"],
                    competitors: ["Competitor Intelligence", "Market share and sentiment benchmarks"],
                    trends: ["Trending Topics", "NLP-extracted conversation themes"]
                };
                if (els.pageTitle) els.pageTitle.textContent = titles[item][0];
                if (els.pageSub) els.pageSub.textContent = titles[item][1];
                
                render();
            });
        }
    });

    els.settingsBtn?.addEventListener("click", () => els.settingsModal.classList.toggle("hidden"));
    document.getElementById("settings-close-overlay")?.addEventListener("click", () => els.settingsModal.classList.add("hidden"));

    // Modal/Drawer Closers
    document.getElementById("brain-close")?.addEventListener("click", () => document.getElementById("brain-modal").classList.add("hidden"));
    document.getElementById("drawer-close")?.addEventListener("click", () => {
        document.getElementById("mention-drawer").classList.add("translate-x-full");
        document.getElementById("drawer-overlay").classList.add("hidden");
    });
    document.getElementById("drawer-overlay")?.addEventListener("click", () => {
        document.getElementById("mention-drawer").classList.add("translate-x-full");
        document.getElementById("drawer-overlay").classList.add("hidden");
    });
}

function showToast(message, type = 'info') {
    if (!els.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-xs font-bold transition-all duration-300 slide-in ${
        type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
        (type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-800 border-white/10 text-white')
    }`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function handleLogout() {
    try {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    } catch (err) {
        showToast("Logout failed", "error");
    }
}

window.handleLogout = handleLogout;

function handleSwitchAccount() {
    handleLogout(); // For now, switching accounts just logs you out to the login screen
}

window.handleSwitchAccount = handleSwitchAccount;

async function handleBrandSearch() {
    const query = els.onboardInput.value.trim();
    if (!query) return;

    els.onboardSearching.classList.remove("hidden");
    els.onboardResult.classList.add("hidden");
    els.onboardError.classList.add("hidden");

    try {
        const res = await fetch(`/api/brands/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Search failed");
        }
        const data = await res.json();
        
        els.onboardSearching.classList.add("hidden");
        
        if (data.exists) {
            els.onboardLogo.src = data.logo || `https://ui-avatars.com/api/?name=${query}&background=4f46e5&color=fff`;
            els.onboardBrandName.textContent = data.brand;
            els.onboardResult.classList.remove("hidden");
        } else {
            document.getElementById("error-query").textContent = query;
            els.onboardRecs.innerHTML = data.recommendations.map(r => `
                <button onclick="document.getElementById('onboard-brand-input').value='${r}'; document.getElementById('onboard-search-btn').click()" class="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all">${r}</button>
            `).join("");
            els.onboardError.classList.remove("hidden");
        }
    } catch (err) {
        showToast(err.message || "Search failed", "error");
        els.onboardSearching.classList.add("hidden");
    }
}

async function executeOnboardingSync() {
    const brand = els.onboardBrandName.textContent;
    document.getElementById("onboard-step-1").classList.add("hidden");
    document.getElementById("onboard-step-2").classList.remove("hidden");

    const steps = [
        { per: 20, status: "Connecting to Global Social Graph..." },
        { per: 45, status: "Scraping YouTube & Reddit streams..." },
        { per: 70, status: "Running NLP Sentiment Extraction..." },
        { per: 90, status: "Categorizing Crisis Risk levels..." },
        { per: 100, status: "Intelligence Sync Complete!" }
    ];

    for (const step of steps) {
        await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));
        document.getElementById("sync-bar").style.width = `${step.per}%`;
        document.getElementById("sync-per").textContent = `${step.per}%`;
        document.getElementById("sync-status").textContent = step.status;
    }

    try {
        const res = await fetch('/api/brands', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand_name: brand })
        });
        
        if (res.ok) {
            showToast(`Tracking ${brand} successfully!`, 'success');
            state.selectedBrand = brand;
            els.brandSelect.value = brand;
            
            // Re-fetch all data for the new brand
            await refreshBrands();
            await refreshMentions();
            await refreshCrisis();
            await refreshCompetitors();
            await refreshTrends();
            
            setTimeout(() => {
                els.onboardModal.classList.add("hidden");
                // Reset for next time
                document.getElementById("onboard-step-1").classList.remove("hidden");
                document.getElementById("onboard-step-2").classList.add("hidden");
                els.onboardInput.value = "";
                render();
            }, 1000);
        }
    } catch (err) {
        showToast("Final sync failed", "error");
    }
}

async function openBrainModal() {
    const modal = document.getElementById("brain-modal");
    const content = document.getElementById("brain-content");
    
    modal.classList.remove("hidden");
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
            <h3 class="text-xl font-black text-slate-900 mb-2">Engaging Neural Core...</h3>
            <p class="text-slate-400 text-[10px] uppercase tracking-widest font-black">Synthesizing platform intelligence for ${state.selectedBrand || 'Global Market'}</p>
        </div>
    `;

    try {
        const res = await fetch("/api/ai/insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brand: state.selectedBrand })
        });
        const data = await res.json();
        
        // Add a slight delay for "wow" effect of the animation
        await new Promise(r => setTimeout(r, 1200));
        
        content.innerHTML = `
            <div class="prose max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-strong:text-slate-900 prose-hr:border-slate-100">
                ${marked.parse(data.insight)}
            </div>
            <div class="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <i data-lucide="check-circle" class="w-7 h-7"></i>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest">Intelligence Confidence</p>
                        <p class="text-xl font-black text-slate-900">${data.healthScore}% Precision</p>
                    </div>
                </div>
                <button onclick="window.print()" class="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-200">
                    <i data-lucide="download" class="w-4 h-4"></i> EXPORT REPORT
                </button>
            </div>
        `;
        lucide.createIcons();
    } catch (err) {
        content.innerHTML = `<div class="p-20 text-center"><p class="text-rose-500 font-black mb-2 uppercase tracking-widest">Neural Link Severed</p><p class="text-slate-400 text-[10px] font-bold">FAILED TO SYNTHESIZE AI INSIGHTS. CHECK NETWORK STATUS.</p></div>`;
    }
}

async function executeLiveSync() {
    if (!state.selectedBrand) return;
    const btn = els.liveSyncBtn;
    const icon = btn.querySelector("i");
    icon.classList.add("animate-spin");
    
    try {
        const platforms = ["youtube", "twitter", "reddit", "instagram", "tiktok"];
        const p = platforms[Math.floor(Math.random() * platforms.length)];
        const res = await fetch(`/api/fetch-live?brand=${encodeURIComponent(state.selectedBrand)}&platform=${p}`);
        const data = await res.json();
        if (data.mention) {
            state.rawMentions.unshift(data.mention);
            processMentionsByThreshold();
            showToast(`Interrupted live mention on ${p}!`, "success");
            render();
        }
    } catch (err) {
        showToast("Sync failed", "error");
    } finally {
        icon.classList.remove("animate-spin");
    }
}

function getFilteredMentions() {
    return state.rawMentions.filter(m => {
        const matchesBrand = !state.selectedBrand || state.selectedBrand === "All Brands" || m.brand === state.selectedBrand;
        const matchesSearch = !state.searchQuery || (m.text && m.text.toLowerCase().includes(state.searchQuery));
        return matchesBrand && matchesSearch;
    });
}

function render() {
    const filtered = getFilteredMentions();

    if (state.activeSection === "overview") {
        renderKpis(filtered);
        renderCharts(filtered);
        renderEmotions();
        renderPlatformPulse(filtered);
    } else if (state.activeSection === "mentions") {
        renderMentionsList(filtered);
    }
}

function renderKpis(mentions) {
    if (!els.kpiCards) return;
    const total = mentions.length;
    const reach = mentions.reduce((acc, m) => acc + (m.reach || 0), 0);

    els.kpiCards.innerHTML = `
        <div class="kpi-card bg-white border border-slate-100 shadow-sm flex items-center gap-6">
          <div class="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <i data-lucide="bar-chart-2" class="w-7 h-7"></i>
          </div>
          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Volume</p>
            <h2 class="text-2xl font-black text-slate-900">${total.toLocaleString()}</h2>
          </div>
        </div>
        <div class="kpi-card bg-white border border-slate-100 shadow-sm flex items-center gap-6">
          <div class="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600">
            <i data-lucide="users" class="w-7 h-7"></i>
          </div>
          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Reach</p>
            <h2 class="text-2xl font-black text-slate-900">${(reach/1000000).toFixed(1)}M</h2>
          </div>
        </div>
        <div class="kpi-card bg-indigo-600 text-white flex items-center gap-6 shadow-xl shadow-indigo-100">
          <div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white">
            <i data-lucide="trending-up" class="w-7 h-7"></i>
          </div>
          <div>
            <p class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Momentum</p>
            <h2 class="text-2xl font-black text-white">+12.5%</h2>
          </div>
        </div>
    `;
    lucide.createIcons();
    
    // Fetch real health score if possible
    fetchHealthScore();
}

async function fetchHealthScore() {
    try {
        const brand = state.selectedBrand === "All Brands" ? "" : state.selectedBrand;
        const res = await fetch("/api/ai/insights", {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ brand })
        });
        const data = await res.json();
        const el = document.getElementById("health-score-val");
        if (el) el.textContent = data.healthScore || "--";
    } catch(e) {}
}

function renderMentionsList(mentions) {
    if (!els.mentionsList) return;
    
    let sorted = [...mentions];
    if (state.sort === "impact") sorted.sort((a,b) => b.reach - a.reach);
    else if (state.sort === "crisis") sorted.sort((a,b) => (b.crisis_score || 0) - (a.crisis_score || 0));
    else sorted.sort((a,b) => new Date(b.published_at) - new Date(a.published_at));

    const start = (state.page - 1) * state.pageSize;
    const paged = sorted.slice(start, start + state.pageSize);

    if (els.mentionsPaginationLabel) els.mentionsPaginationLabel.textContent = `Page ${state.page} of ${Math.ceil(sorted.length/state.pageSize) || 1}`;

    els.mentionsList.innerHTML = paged.map(m => `
        <div class="p-8 hover:bg-slate-50/80 transition-all cursor-pointer group" onclick='openMentionDrawer(${JSON.stringify(m).replace(/'/g, "&apos;")})'>
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <i data-lucide="${getPlatformIcon(m.channel)}" class="w-5 h-5 text-slate-500"></i>
                    </div>
                    <div>
                        <p class="text-sm font-black text-slate-900">${m.author || 'Anonymous'}</p>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${m.channel} • ${new Date(m.published_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <span class="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${m.sentimentLabel === 'positive' ? 'badge-pos' : (m.sentimentLabel === 'negative' ? 'badge-neg' : 'badge-neu')}">${m.sentimentLabel}</span>
            </div>
            <p class="text-base text-slate-600 leading-relaxed line-clamp-2 mb-4 font-medium">${m.text}</p>
            <div class="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span class="flex items-center gap-2"><i data-lucide="users" class="w-3.5 h-3.5"></i>${(m.reach || 0).toLocaleString()} Reach</span>
                <span class="flex items-center gap-2"><i data-lucide="heart" class="w-3.5 h-3.5"></i>${m.likes || 0}</span>
                <span class="flex items-center gap-2"><i data-lucide="share-2" class="w-3.5 h-3.5"></i>${m.shares || 0}</span>
            </div>
        </div>
    `).join("");
    lucide.createIcons();
}

function getPlatformIcon(p) {
    const icons = { youtube: "youtube", twitter: "twitter", reddit: "message-square", instagram: "instagram", tiktok: "video", facebook: "facebook", linkedin: "linkedin", news: "newspaper" };
    return icons[p] || "globe";
}

function startPlatformTour() {}
// Tour logic removed

function openMentionDrawer(m) {
    const drawer = document.getElementById("mention-drawer");
    const overlay = document.getElementById("drawer-overlay");
    if (!drawer || !overlay) return;

    document.getElementById("drawer-text").textContent = m.text;
    document.getElementById("drawer-channel").textContent = m.channel;
    const sEl = document.getElementById("drawer-sentiment");
    if (sEl) {
        sEl.textContent = m.sentimentLabel;
        sEl.className = `text-sm font-black uppercase tracking-widest ${m.sentimentLabel === 'positive' ? 'text-emerald-500' : (m.sentimentLabel === 'negative' ? 'text-rose-500' : 'text-slate-400')}`;
    }
    const eEl = document.getElementById("drawer-emotion");
    if (eEl) eEl.textContent = m.emotion || "neutral";
    
    const iEl = document.getElementById("drawer-intent");
    if (iEl) iEl.textContent = (m.intent || "general").replace("_", " ");
    
    const aEl = document.getElementById("drawer-aspect");
    if (aEl) aEl.textContent = (m.aspect || "general").replace("_", " ");
    
    const rEl = document.getElementById("drawer-reach");
    if (rEl) rEl.textContent = (m.reach || 0).toLocaleString();
    
    const fEl = document.getElementById("drawer-influence");
    if (fEl) fEl.textContent = `${m.author_influence || 0}/100`;
    
    const cEl = document.getElementById("drawer-crisis");
    if (cEl) {
        cEl.textContent = m.crisis_score || 0;
        cEl.className = `text-sm font-black ${m.crisis_score > 70 ? 'text-rose-500' : (m.crisis_score > 40 ? 'text-orange-500' : 'text-slate-900')}`;
    }
    document.getElementById("drawer-url").href = m.url || "#";

    const topicsList = document.getElementById("drawer-topics");
    if (m.keybert_topics && topicsList) {
        const topics = Array.isArray(m.keybert_topics) ? m.keybert_topics : m.keybert_topics.split(",");
        topicsList.innerHTML = topics.map(t => `<span class="px-2 py-1 bg-white/5 text-slate-300 text-[10px] font-bold rounded-md border border-white/10">${t.trim()}</span>`).join("");
    }

    drawer.classList.remove("translate-x-full");
    overlay.classList.remove("hidden");
}

function renderCharts(mentions) {
    const trendCtx = document.getElementById("trend-chart")?.getContext("2d");
    const donutCtx = document.getElementById("donut-chart")?.getContext("2d");
    
    if (!trendCtx || !donutCtx) return;

    if (sentimentChart) sentimentChart.destroy();
    
    const countsByDay = {};
    mentions.forEach(m => {
        const date = new Date(m.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        countsByDay[date] = (countsByDay[date] || 0) + 1;
    });
    
    const labels = Object.keys(countsByDay).sort((a,b) => new Date(a) - new Date(b)).slice(-10);
    const data = labels.map(l => countsByDay[l]);

    sentimentChart = new Chart(trendCtx, {
        type: state.chartType || "bar",
        data: {
            labels,
            datasets: [{
                label: "Mentions",
                data,
                backgroundColor: "#4F46E5",
                borderColor: "#4F46E5",
                borderRadius: 12,
                barThickness: 20,
                tension: 0.4,
                fill: state.chartType === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.03)" }, ticks: { color: "#94A3B8", font: { size: 10, weight: '700' } }, border: { display: false } },
                x: { grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 10, weight: '700' } }, border: { display: false } } 
            },
            plugins: { legend: { display: false } }
        }
    });

    if (distributionChart) distributionChart.destroy();
    
    const pos = mentions.filter(m => m.sentimentLabel === "positive").length;
    const neu = mentions.filter(m => m.sentimentLabel === "neutral").length;
    const neg = mentions.filter(m => m.sentimentLabel === "negative").length;
    const colors = {
        positive: "#10B981",
        neutral: "#94A3B8",
        negative: "#F43F5E"
    };

    distributionChart = new Chart(donutCtx, {
        type: "doughnut",
        data: {
            labels: ["Positive", "Neutral", "Negative"],
            datasets: [{
                data: [pos, neu, neg],
                backgroundColor: [colors.positive, colors.neutral, colors.negative],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "75%",
            plugins: { legend: { display: false } }
        }
    });

    els.distLegend.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full" style="background:${colors.positive}"></div>
                <span class="text-xs font-black text-slate-900">Positive</span>
            </div>
            <span class="text-xs font-black text-emerald-500">${pos}</span>
        </div>
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full" style="background:${colors.neutral}"></div>
                <span class="text-xs font-black text-slate-900">Neutral</span>
            </div>
            <span class="text-xs font-black text-slate-400">${neu}</span>
        </div>
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full" style="background:${colors.negative}"></div>
                <span class="text-xs font-black text-slate-900">Negative</span>
            </div>
            <span class="text-xs font-black text-rose-500">${neg}</span>
        </div>
    `;
}

function renderEmotions() {
    const container = document.getElementById("emotion-bars");
    if (!container) return;
    
    // Mocking emotion distribution for the current mentions
    const emotions = [
        { label: "Joy/Trust", value: 45, color: "#10B981" },
        { label: "Surprise", value: 25, color: "#06B6D4" },
        { label: "Anticipation", value: 20, color: "#6366F1" },
        { label: "Anger/Frustration", value: 10, color: "#F43F5E" }
    ];
    
    container.innerHTML = emotions.map(e => `
        <div class="space-y-2">
            <div class="flex justify-between items-end">
                <span class="text-xs font-black text-slate-900 uppercase tracking-tight">${e.label}</span>
                <span class="text-[10px] font-black" style="color:${e.color}">${e.value}%</span>
            </div>
            <div class="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div class="h-full rounded-full transition-all duration-1000" style="width: ${e.value}%; background: ${e.color}"></div>
            </div>
        </div>
    `).join("");
}

function renderPlatformPulse(mentions) {
    const grid = document.getElementById("platform-grid");
    if (!grid) return;
    
    const platforms = ["youtube", "twitter", "reddit", "instagram", "tiktok", "facebook", "linkedin", "news"];
    const stats = platforms.map(p => {
        const ms = mentions.filter(m => m.channel === p);
        const count = ms.length;
        const pos = ms.filter(m => m.sentimentLabel === "positive").length;
        const neg = ms.filter(m => m.sentimentLabel === "negative").length;
        const score = count ? Math.round(((pos - neg) / count) * 100) : 0;
        return { p, count, score };
    });
    
    grid.innerHTML = stats.map(s => `
        <div class="platform-card">
            <i data-lucide="${getPlatformIcon(s.p)}" class="w-5 h-5 text-slate-400 mx-auto mb-3"></i>
            <p class="text-xs font-black text-slate-900 mb-1">${s.count}</p>
            <p class="text-[9px] font-black tracking-widest uppercase ${s.score > 0 ? 'text-emerald-500' : (s.score < 0 ? 'text-rose-500' : 'text-slate-400')}">${s.score > 0 ? '+' : ''}${s.score}%</p>
        </div>
    `).join("");
    lucide.createIcons();
}

function renderCrisis(alerts) {
    const list = document.getElementById("crisis-alerts-list");
    if (!list) return;
    
    list.innerHTML = alerts.length ? alerts.map(a => `
        <div class="crisis-card slide-in">
            <div class="flex items-center justify-between mb-4">
                <span class="text-[9px] font-black px-3 py-1 bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-full uppercase tracking-widest">${a.type.replace("_", " ")}</span>
                <span class="text-[10px] font-bold text-slate-400">${new Date(a.created_at).toLocaleDateString()}</span>
            </div>
            <h4 class="text-base font-black text-slate-900 mb-2">Critical Risk Detected: ${a.risk_score}/100</h4>
            <p class="text-sm text-slate-600 leading-relaxed mb-6 font-medium">${a.summary}</p>
            <div class="bg-indigo-600 rounded-2xl p-5 shadow-lg shadow-indigo-100">
                <p class="text-[9px] font-black text-white/60 uppercase tracking-widest mb-2">Recommended Strategy</p>
                <p class="text-sm text-white font-bold leading-snug">${a.recommended_action}</p>
            </div>
        </div>
    `).join("") : '<div class="text-center py-20 text-slate-400 text-[10px] font-black uppercase tracking-widest col-span-full">✅ All signals nominal. No active crisis detected.</div>';
}

function renderCompetitors(data) {
    const grid = document.getElementById("competitor-grid");
    if (!grid) return;
    
    grid.innerHTML = Object.entries(data).map(([name, d]) => `
        <div class="flex items-center gap-6 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-900 text-sm shadow-sm border border-slate-100">${name[0]}</div>
            <div class="flex-1">
                <div class="flex items-center justify-between mb-2">
                    <p class="text-sm font-black text-slate-900">${name}</p>
                    <p class="text-[10px] font-black ${d.sentiment === 'positive' ? 'text-emerald-500' : 'text-rose-500'} uppercase tracking-widest">${d.positiveRatio}% Positive</p>
                </div>
                <div class="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div class="h-full ${d.sentiment === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'}" style="width:${d.positiveRatio}%"></div>
                </div>
            </div>
            <div class="text-right">
                <p class="text-sm font-black text-slate-900">${d.mentions}</p>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signals</p>
            </div>
        </div>
    `).join("");
}

function renderTrends(trends) {
    const grid = document.getElementById("trends-grid");
    if (!grid) return;
    
    grid.innerHTML = trends.map(t => `
        <div class="flex items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
            <i data-lucide="${t.velocity === 'rising' ? 'trending-up' : (t.velocity === 'falling' ? 'trending-down' : 'minus')}" class="w-3.5 h-3.5 ${t.velocity === 'rising' ? 'text-emerald-500' : (t.velocity === 'falling' ? 'text-rose-500' : 'text-slate-400')}"></i>
            <span class="ml-2 text-sm font-bold text-slate-900">${t.topic}</span>
            <span class="ml-auto text-xs font-black text-slate-400">${t.mentions}</span>
        </div>
    `).join("");
    lucide.createIcons();
}

// Sensitivity management
let sentimentThreshold = 0.10;
function processMentionsByThreshold() {
    state.rawMentions.forEach(m => {
        const score = m.vader_score || 0;
        m.sentimentLabel = score >= sentimentThreshold ? "positive" : (score <= -sentimentThreshold ? "negative" : "neutral");
    });
}

const sensSlider = document.getElementById("sens-slider");
const sensVal = document.getElementById("sens-val");
if (sensSlider) {
    sensSlider.addEventListener("input", (e) => {
        sentimentThreshold = parseFloat(e.target.value);
        if (sensVal) sensVal.textContent = sentimentThreshold.toFixed(2);
        processMentionsByThreshold();
        render();
    });
}

init();
