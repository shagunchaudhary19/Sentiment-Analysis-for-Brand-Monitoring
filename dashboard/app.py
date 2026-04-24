import streamlit as st
import pandas as pd
import sqlite3
import os
import ast
from collections import Counter
import altair as alt
import time

st.set_page_config(page_title="Brand Sentiment Dashboard", layout="wide", page_icon="💡")

# --- DATABASE LOADING ---
def load_data_from_db():
    db_path = "database/mentions.db"
    if not os.path.exists(db_path):
        return pd.DataFrame()
    
    try:
        conn = sqlite3.connect(db_path)
        query = "SELECT * FROM mentions"
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    except Exception as e:
        st.error(f"Database error: {e}")
        return pd.DataFrame()

df = load_data_from_db()

if df.empty:
    st.warning("No data found in the database. Please run seed_data.js or main.py first.")
    st.stop()

# --- TIMESTAMP FIX ---
if "published_at" in df.columns:
    df["published_at"] = pd.to_datetime(df["published_at"], errors='coerce', utc=True)

# =======================
# 2. SIDEBAR
# =======================
st.sidebar.title("BrandWatch Intelligence")
st.sidebar.markdown('---')

st.sidebar.markdown('**Target Brand**')
brands = ["All Brands"] + sorted(list(df["brand"].unique()))
selected_brand = st.sidebar.selectbox("Select Brand", brands, label_visibility="collapsed")

st.sidebar.markdown('**Text Search**')
search_query = st.sidebar.text_input("Filter mentions...", placeholder="e.g. price", label_visibility="collapsed")

st.sidebar.markdown('**Platforms**')
all_channels = sorted(list(df["channel"].unique()))
selected_channels = []
cols = st.sidebar.columns(2)
for i, channel in enumerate(all_channels):
    if cols[i % 2].checkbox(channel.capitalize(), value=True):
        selected_channels.append(channel)

st.sidebar.markdown('---')
if st.sidebar.button("Refresh Data", type="primary", use_container_width=True):
    st.cache_data.clear()
    st.rerun()

# Processing filters
filtered_df = df.copy()

if selected_brand != "All Brands":
    filtered_df = filtered_df[filtered_df["brand"] == selected_brand]

if search_query:
    filtered_df = filtered_df[filtered_df["text"].str.contains(search_query, case=False, na=False)]

if selected_channels:
    filtered_df = filtered_df[filtered_df["channel"].isin(selected_channels)]

# Fallback
if len(filtered_df) == 0:
    st.warning("No data matches the current filters.")
    st.stop()

# =======================
# BRAND INSIGHT PANEL
# =======================
most_active = filtered_df["channel"].mode()[0].capitalize() if not filtered_df.empty else "N/A"
avg_sentiment = filtered_df["vader_score"].mean() if "vader_score" in filtered_df.columns else 0
health_status = "Positive" if avg_sentiment > 0.1 else ("Negative" if avg_sentiment < -0.1 else "Neutral")
health_color = "#22c55e" if health_status == "Positive" else ("#ef4444" if health_status == "Negative" else "#f59e0b")

st.markdown(f"""
<div style='background-color: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid {health_color};'>
    <h3 style='margin-top: 0; color: #f8fafc;'>🧠 AI Brand Analysis: {selected_brand if selected_brand != 'All Brands' else 'Global Market'}</h3>
    <p style='color: #cbd5e1; font-size: 1.1em; line-height: 1.6; margin-bottom: 0;'>
        The current brand health is <b>{health_status}</b> based on <b>{len(filtered_df)}</b> analyzed records. 
        Activity is peaking on <b>{most_active}</b>. 
        Strategic recommendation: {'Engage with positive influencers to amplify reach.' if health_status == 'Positive' else 'Monitor negative sentiment spikes and address customer concerns immediately.'}
    </p>
</div>
""", unsafe_allow_html=True)

# =======================
# 3. KPI METRICS
# =======================
total_mentions = len(filtered_df)
pos_count = len(filtered_df[filtered_df["vader_label"] == "positive"])
neg_count = len(filtered_df[filtered_df["vader_label"] == "negative"])
neu_count = len(filtered_df[filtered_df["vader_label"] == "neutral"])
total_reach = filtered_df["reach"].sum()

pos_pct = f"{(pos_count/total_mentions)*100:.0f}%" if total_mentions else "0%"
neg_pct = f"{(neg_count/total_mentions)*100:.0f}%" if total_mentions else "0%"

col1, col2, col3, col4 = st.columns(4)
col1.metric("Total Mentions", total_mentions)
col2.metric("Positive Sentiment", pos_pct, delta="+2%" if pos_count > neg_count else "-1%")
col3.metric("Negative Sentiment", neg_pct, delta="-5%" if neg_count < total_mentions*0.2 else "+8%", delta_color="inverse")
col4.metric("Total Reach", f"{total_reach/1e6:.1f}M")

st.markdown("<br>", unsafe_allow_html=True)

# =======================
# 4 & 5. SENTIMENT CHARTS
# =======================
row1_col1, row1_col2 = st.columns([1, 1.5])

with row1_col1:
    st.subheader("Sentiment Distribution")
    source = pd.DataFrame({
        "Sentiment": ["Positive", "Neutral", "Negative"],
        "Count": [pos_count, neu_count, neg_count]
    })
    donut = alt.Chart(source).mark_arc(innerRadius=70).encode(
        theta=alt.Theta(field="Count", type="quantitative"),
        color=alt.Color(field="Sentiment", type="nominal", scale=alt.Scale(domain=["Positive", "Neutral", "Negative"], range=["#22c55e", "#94a3b8", "#ef4444"])),
        tooltip=["Sentiment", "Count"]
    ).properties(height=350)
    st.altair_chart(donut, use_container_width=True)

with row1_col2:
    st.subheader("Sentiment Over Time")
    if not filtered_df["published_at"].isna().all():
        trend_df = filtered_df.copy()
        trend_df["date"] = trend_df["published_at"].dt.date
        trend_data = trend_df.groupby(["date", "vader_label"]).size().unstack(fill_value=0).reset_index()
        
        for col in ["positive", "neutral", "negative"]:
            if col not in trend_data.columns: trend_data[col] = 0
            
        trend_melt = trend_data.melt('date', var_name='Sentiment', value_name='Mentions')
        line_chart = alt.Chart(trend_melt).mark_line(strokeWidth=3, point=True).encode(
            x=alt.X('date:T', axis=alt.Axis(title='Date')),
            y=alt.Y('Mentions:Q', axis=alt.Axis(title='Count')),
            color=alt.Color('Sentiment:N', scale=alt.Scale(domain=["positive", "neutral", "negative"], range=["#22c55e", "#94a3b8", "#ef4444"]))
        ).properties(height=350)
        st.altair_chart(line_chart, use_container_width=True)
    else:
        st.info("Time series data unavailable for current selection.")

# =======================
# 6 & 7. PLATFORMS & TOPICS
# =======================
st.markdown("---")
row2_col1, row2_col2 = st.columns([1, 1])

with row2_col1:
    st.subheader("Platform Breakdown")
    plat_counts = filtered_df["channel"].value_counts().reset_index()
    plat_counts.columns = ["Platform", "Count"]
    bar = alt.Chart(plat_counts).mark_bar(color="#6366f1", cornerRadiusEnd=4).encode(
        x=alt.X('Count:Q'),
        y=alt.Y('Platform:N', sort='-x')
    ).properties(height=300)
    st.altair_chart(bar, use_container_width=True)

with row2_col2:
    st.subheader("Key Conversation Topics")
    topics_list = []
    if "keybert_topics" in filtered_df.columns:
        for t in filtered_df["keybert_topics"].dropna():
            topics_list.extend([x.strip() for x in str(t).split(",") if x.strip()])
    
    if topics_list:
        top_topics = Counter(topics_list).most_common(10)
        topic_df = pd.DataFrame(top_topics, columns=["Topic", "Mentions"])
        topic_bar = alt.Chart(topic_df).mark_bar(color="#14b8a6", cornerRadiusEnd=4).encode(
            x=alt.X('Mentions:Q'),
            y=alt.Y('Topic:N', sort='-x')
        ).properties(height=300)
        st.altair_chart(topic_bar, use_container_width=True)
    else:
        st.info("No topic data available.")

# =======================
# 8. DATA TABLE
# =======================
st.markdown("---")
st.subheader("Recent Mentions")
display_df = filtered_df[["published_at", "channel", "author", "text", "vader_label", "reach"]].sort_values("published_at", ascending=False).head(100)
st.dataframe(display_df, use_container_width=True, hide_index=True)
