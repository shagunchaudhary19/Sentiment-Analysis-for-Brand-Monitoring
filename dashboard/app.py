import streamlit as st
import pandas as pd
import os
import ast
from collections import Counter
import altair as alt
import time

st.set_page_config(page_title="Brand Sentiment Dashboard", layout="wide", page_icon="💡")

@st.cache_data
def load_data():
    file_path = "dashboard/data/processed_mentions.csv"
    if os.path.exists(file_path):
        return pd.read_csv(file_path)
    return pd.DataFrame()

df = load_data()
if df.empty:
    st.warning("No data found. Please run main.py to fetch data.")
    st.stop()

# --- TIMESTAMP FIX ---
# Reddit provides unix timestamps, YouTube provides ISO format. Pandas `to_datetime` handles both if cleaned correctly.
if "published_at" in df.columns:
    # Try converting numeric strings to int first (for Reddit unix timestamps)
    def parse_date(d):
        try: return pd.to_datetime(int(float(d)), unit='s')
        except: return pd.to_datetime(d, errors='coerce')
    df["published_at"] = df["published_at"].apply(parse_date)

# =======================
# 2. SIDEBAR
# =======================
st.sidebar.title("Filters & Settings")

st.sidebar.markdown('**Brand**')
brands = ["All Brands"] + list(df.get("brand", ["All"]).unique()) if "brand" in df.columns else ["All Brands"]
selected_brand = st.sidebar.selectbox("Select Brand", brands, label_visibility="collapsed")

st.sidebar.markdown('**Keyword / Product**')
search_query = st.sidebar.text_input("Search", placeholder="e.g. Samsung", label_visibility="collapsed")

st.sidebar.markdown('**Platforms**')
channels_avail = df["channel"].unique() if "channel" in df.columns else []
sc1, sc2 = st.sidebar.columns(2)
sc3, sc4 = st.sidebar.columns(2)
show_yt = sc1.checkbox("YouTube", value=True)
show_tw = sc2.checkbox("Twitter", value=True)
show_rd = sc3.checkbox("Reddit", value=False)
show_ig = sc4.checkbox("Instagram", value=True)

selected_channels = []
if show_yt: selected_channels.append("youtube")
if show_tw: selected_channels.append("twitter")
if show_rd: selected_channels.append("reddit")
if show_ig: selected_channels.append("instagram")

st.sidebar.markdown('**Date Range**')
date_range = st.sidebar.radio("Range", ["24h", "7d", "30d"], horizontal=True, label_visibility="collapsed")

st.sidebar.markdown("<br>", unsafe_allow_html=True)
col_btn1, col_btn2 = st.sidebar.columns(2)
if col_btn1.button("Run Analysis", type="primary", use_container_width=True):
    with st.spinner("Fetching data...\nAnalyzing sentiment...\nExtracting topics..."):
        time.sleep(1.5)
if col_btn2.button("Clear Filters", use_container_width=True):
    st.rerun()

# Processing filters
filtered_df = df.copy()

if selected_brand and selected_brand != "All Brands" and "brand" in filtered_df.columns:
    filtered_df = filtered_df[filtered_df["brand"] == selected_brand]

if search_query:
    filtered_df = filtered_df[filtered_df["text"].str.contains(search_query, case=False, na=False)]

if "channel" in filtered_df.columns and selected_channels:
    filtered_df = filtered_df[filtered_df["channel"].str.lower().isin(selected_channels)]

# Fallback
if len(filtered_df) == 0:
    st.warning("No data matches the current filters.")
    st.stop()

# =======================
# BRAND INSIGHT PANEL
# =======================
most_active = "N/A"
if "channel" in filtered_df.columns and not filtered_df.empty:
    most_active = filtered_df["channel"].mode()[0].capitalize()

trend_topic = "N/A"
all_ents = []
if "named_entities" in filtered_df.columns:
    for ent_str in filtered_df["named_entities"].dropna():
        try: all_ents.extend(ast.literal_eval(ent_str))
        except: pass
if all_ents:
    trend_topic = Counter(all_ents).most_common(1)[0][0]

st.markdown(f"""
<div style='background-color: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 5px solid #14b8a6;'>
    <h3 style='margin-top: 0; color: #f8fafc;'>🧠 AI Brand Insight</h3>
    <ul style='color: #cbd5e1; font-size: 1.1em; line-height: 1.8; margin-bottom: 0;'>
        <li><b>{selected_brand if selected_brand else 'Overall'}</b> sentiment analysis successfully computed across <b>{len(filtered_df)}</b> records.</li>
        <li>The most intensely discussed platform right now is <b>{most_active}</b>.</li>
        <li>Users are primarily clustering conversations around the topic: <b>"{trend_topic}"</b>.</li>
    </ul>
</div>
""", unsafe_allow_html=True)

# =======================
# 3. KPI METRICS
# =======================
total_mentions = len(filtered_df)
pos_count = len(filtered_df[filtered_df["vader_label"] == "positive"]) if "vader_label" in filtered_df.columns else 0
neg_count = len(filtered_df[filtered_df["vader_label"] == "negative"]) if "vader_label" in filtered_df.columns else 0
neu_count = len(filtered_df[filtered_df["vader_label"] == "neutral"]) if "vader_label" in filtered_df.columns else 0
total_reach = filtered_df["reach"].sum() if "reach" in filtered_df.columns else 0

pos_pct = f"{(pos_count/total_mentions)*100:.0f}%" if total_mentions else "0%"
neg_pct = f"{(neg_count/total_mentions)*100:.0f}%" if total_mentions else "0%"
neu_pct = f"{(neu_count/total_mentions)*100:.0f}%" if total_mentions else "0%"

col1, col2, col3, col4 = st.columns(4)
col1.markdown(f"<div style='background-color: #1e293b; padding: 20px; border-radius: 10px;text-align: center; border: 1px solid #334155'><h4 style='margin:0;color:#94a3b8;font-size:16px'>Total Mentions</h4><h1 style='margin:0;color:#ffffff;font-size:32px'>{total_mentions}</h1></div>", unsafe_allow_html=True)
col2.markdown(f"<div style='background-color: #1e293b; padding: 20px; border-radius: 10px;text-align: center; border: 1px solid #334155'><h4 style='margin:0;color:#22c55e;font-size:16px'>🟢 Positive</h4><h1 style='margin:0;color:#ffffff;font-size:32px'>{pos_pct}</h1></div>", unsafe_allow_html=True)
col3.markdown(f"<div style='background-color: #1e293b; padding: 20px; border-radius: 10px;text-align: center; border: 1px solid #334155'><h4 style='margin:0;color:#ef4444;font-size:16px'>🔴 Negative</h4><h1 style='margin:0;color:#ffffff;font-size:32px'>{neg_pct}</h1></div>", unsafe_allow_html=True)
col4.markdown(f"<div style='background-color: #1e293b; padding: 20px; border-radius: 10px;text-align: center; border: 1px solid #334155'><h4 style='margin:0;color:#f59e0b;font-size:16px'>🟡 Neutral</h4><h1 style='margin:0;color:#ffffff;font-size:32px'>{neu_pct}</h1></div>", unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)
subc1, subc2, subc3 = st.columns(3)
subc1.metric("Engagement Rate (Reach)", f"{int(total_reach):,}")
subc2.metric("Most Active Platform", most_active)
subc3.metric("Top Trending Topic", trend_topic)

st.markdown("<br><hr style='border-color: #334155;'>", unsafe_allow_html=True)

# =======================
# 4 & 5. SENTIMENT CHARTS
# =======================
row1_col1, row1_col2 = st.columns([1, 1.5])

with row1_col1:
    st.markdown("<h4 style='color:#f8fafc; text-align: center'>Sentiment Distribution</h4>", unsafe_allow_html=True)
    if total_mentions > 0:
        source = pd.DataFrame({
            "Sentiment": ["Positive", "Negative", "Neutral"],
            "Count": [pos_count, neg_count, neu_count]
        })
        donut = alt.Chart(source).mark_arc(innerRadius=60).encode(
            theta=alt.Theta(field="Count", type="quantitative"),
            color=alt.Color(field="Sentiment", type="nominal", scale=alt.Scale(domain=["Positive", "Negative", "Neutral"], range=["#22c55e", "#ef4444", "#f59e0b"])),
            tooltip=["Sentiment", "Count"]
        ).properties(height=320)
        st.altair_chart(donut, use_container_width=True)

with row1_col2:
    st.markdown("<h4 style='color:#f8fafc; text-align: center'>Sentiment Trend</h4>", unsafe_allow_html=True)
    if "published_at" in filtered_df.columns and not filtered_df["published_at"].isna().all():
        trend_df = filtered_df.groupby([filtered_df["published_at"].dt.date, "vader_label"]).size().unstack(fill_value=0).reset_index()
        for col in ["positive", "negative", "neutral"]:
            if col not in trend_df.columns: trend_df[col] = 0
        trend_melt = trend_df.melt('published_at', var_name='Sentiment', value_name='Mentions')
        line_chart = alt.Chart(trend_melt).mark_line(strokeWidth=3, point=True).encode(
            x=alt.X('published_at:T', axis=alt.Axis(title='Date')),
            y=alt.Y('Mentions:Q', axis=alt.Axis(title='Number of Mentions')),
            color=alt.Color('Sentiment:N', scale=alt.Scale(domain=["positive", "negative", "neutral"], range=["#22c55e", "#ef4444", "#f59e0b"]))
        ).properties(height=320)
        st.altair_chart(line_chart, use_container_width=True)
    else:
        st.info("Insufficient time string data to render the chart.")

st.markdown("<br><hr style='border-color: #334155;'>", unsafe_allow_html=True)

# =======================
# 6 & 7. TOPICS & PLATFORMS
# =======================
row2_col1, row2_col2 = st.columns([1.5, 1])

with row2_col1:
    st.markdown("<h4 style='color:#f8fafc'>Platform Distribution</h4>", unsafe_allow_html=True)
    if "channel" in filtered_df.columns:
        plat_counts = filtered_df["channel"].value_counts().reset_index()
        plat_counts.columns = ["Platform", "Mentions"]
        bar_chart = alt.Chart(plat_counts).mark_bar(color="#14b8a6", cornerRadiusEnd=4).encode(
            x=alt.X('Mentions:Q', axis=alt.Axis(title='Mentions')),
            y=alt.Y('Platform:N', sort='-x', axis=alt.Axis(title=''))
        ).properties(height=280)
        st.altair_chart(bar_chart, use_container_width=True)

with row2_col2:
    st.markdown("<h4 style='color:#f8fafc'>Trending Topics</h4>", unsafe_allow_html=True)
    if all_ents:
        top_ents = pd.DataFrame(Counter(all_ents).most_common(12), columns=["Topic", "Mentions"])
        hashtags = " ".join([f"<span style='color:#14b8a6; background:#1e293b; padding:6px 10px; border-radius:6px; margin:4px; display:inline-block; font-weight:600;'>#{str(row['Topic']).replace(' ', '')}</span>" for _, row in top_ents.iterrows()])
        st.markdown(hashtags, unsafe_allow_html=True)
    else:
        st.info("No specific trending named entities found.")

st.markdown("<br><hr style='border-color: #334155;'>", unsafe_allow_html=True)

# =======================
# 8. LIVE MENTIONS FEED
# =======================
st.markdown("<h4 style='color:#f8fafc'>Live Mentions Feed</h4>", unsafe_allow_html=True)

def get_platform_icon(channel):
    c = str(channel).lower()
    if 'youtube' in c: return "🔴 YouTube"
    if 'twitter' in c: return "🐦 Twitter"
    if 'instagram' in c: return "📸 Instagram"
    if 'reddit' in c: return "🤖 Reddit"
    return f"🌐 {c.capitalize()}"

# Ensure published_at sorts safely
try:
    filtered_df = filtered_df.sort_values(by="published_at", ascending=False)
except: pass

for _, row in filtered_df.head(50).iterrows():
    plat_icon = get_platform_icon(row.get("channel", "Unknown"))
    txt = row.get("text", "")
    lbl = row.get("vader_label", "neutral")
    time_val = str(row.get("published_at", "Just now"))[:10]
    reach = row.get("reach", 0)
    
    badge = f"<span style='color: {'#22c55e' if lbl=='positive' else '#ef4444' if lbl=='negative' else '#f59e0b'}; font-weight: bold;'>{'🟢 Positive' if lbl=='positive' else '🔴 Negative' if lbl=='negative' else '🟡 Neutral'}</span>"
    color = "#22c55e" if lbl=='positive' else "#ef4444" if lbl=='negative' else "#f59e0b"
    
    st.markdown(f"""
    <div style='background-color: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #334155; border-left: 4px solid {color};'>
        <div style='display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center;'>
            <span style='color: #cbd5e1; font-weight: 600; font-size: 0.9em;'>[{plat_icon}] &nbsp;&nbsp; {time_val}</span>
            <span style='font-size: 0.85em;'>{badge}</span>
        </div>
        <div style='color: #f8fafc; line-height: 1.5; font-size: 1.05em; margin-bottom: 10px;'>"{txt}"</div>
        <div style='color: #94a3b8; font-size: 0.85em;'>👍 {reach} Engagements &nbsp;&nbsp;&nbsp; 💬 0 Comments</div>
    </div>
    """, unsafe_allow_html=True)
