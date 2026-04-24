import os
import pandas as pd
import sqlite3
from data_pipeline.scraper import fetch_youtube_comments, fetch_news_mentions
from data_pipeline.reddit_scraper import fetch_reddit_comments
from data_pipeline.instagram_scraper import fetch_instagram_mentions
from data_pipeline.facebook_scraper import fetch_facebook_posts
from data_pipeline.cleaner import clean_data
from data_pipeline.preprocessor import preprocess_dataframe
from models.sentiment import analyze_dataframe
from models.topics import extract_keybert_topics, build_lda_model

def run_pipeline(targets: list, output_file: str = "dashboard/data/processed_mentions.json"):
    print(f"--- Starting Pipeline ---")
    
    # 1. Scrape Data
    raw_data = []
    for t in targets:
        brand = t.get("brand", "Unknown")
        keyword = t.get("keyword", brand)

        print(f"1. [{brand}] Fetching YouTube data...")
        yt_data = fetch_youtube_comments(
            query=t.get("youtube_query", keyword),
            brand=brand,
            max_results=25
        )
        print(f"   [{brand}] Fetched {len(yt_data)} YouTube mentions.")

        print(f"   [{brand}] Fetching Reddit data...")
        rd_data = fetch_reddit_comments(
            subreddit_name="technology",
            keyword=t.get("reddit_kw", keyword),
            brand=brand,
            limit=25
        )
        print(f"   [{brand}] Fetched {len(rd_data)} Reddit posts.")

        print(f"   [{brand}] Fetching Instagram data...")
        ig_data = fetch_instagram_mentions(
            keyword=t.get("ig_keyword", keyword),
            brand=brand,
            limit=25
        )
        print(f"   [{brand}] Fetched {len(ig_data)} Instagram posts.")

        print(f"   [{brand}] Fetching Facebook data...")
        fb_data = fetch_facebook_posts(
            keyword=t.get("fb_keyword", keyword),
            brand=brand,
            limit=25
        )
        print(f"   [{brand}] Fetched {len(fb_data)} Facebook posts.")

        print(f"   [{brand}] Fetching News data...")
        nw_data = fetch_news_mentions(
            query=brand, # Use brand name for broad news search
            brand=brand,
            limit=25
        )
        print(f"   [{brand}] Fetched {len(nw_data)} News articles.")

        raw_data.extend(yt_data + rd_data + ig_data + fb_data + nw_data)
        
    if not len(raw_data):
        print("No data fetched. Exiting.")
        return
        
    df = pd.DataFrame(raw_data)
    print(f"\nFetched {len(df)} total records across all platforms.")
    
    # 2. Clean Data
    print("\n2. Cleaning data...")
    df = clean_data(df, text_column="text")
    if df.empty:
        print("Data is empty after cleaning.")
        return
    
    # 3. Preprocess Text
    print("3. Preprocessing text...")
    df = preprocess_dataframe(df, text_column="text")
    
    # 4. Sentiment Analysis
    print("4. Running Sentiment Analysis...")
    df = analyze_dataframe(df, text_column="processed_text")
    
    # 5. Topic Extraction
    print("5. Extracting Topics (KeyBERT)...")
    df['keybert_topics'] = extract_keybert_topics(df['processed_text'].tolist(), top_n=3)
    
    print("   Extracting Topics (LDA)...")
    try:
        lda_topics = build_lda_model(df['processed_text'].tolist(), num_topics=3, num_words=4)
        print("LDA Global Topics:", lda_topics)
    except Exception as e:
        print(f"LDA Error: {e}")
    
    # 6. Save Data (CSV/JSON)
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    csv_file = output_file.replace(".json", ".csv")
    df.to_csv(csv_file, index=False)
    print(f"\nSaved CSV export to {csv_file}")
    df.to_json(output_file, orient='records', indent=2)
    print(f"Saved JSON export to {output_file}")

    # 7. Database Persistence
    db_path = "database/mentions.db"
    print(f"\n7. Persisting {len(df)} records to SQLite database...")
    try:
        conn = sqlite3.connect(db_path)
        count = 0
        for row in df.itertuples():
            try:
                conn.execute('''
                    INSERT OR REPLACE INTO mentions (
                        id, brand, channel, text, author, author_followers, author_influence,
                        published_at, reach, likes, shares, comments,
                        vader_score, vader_label, confidence, emotion, intent, aspect,
                        crisis_score, crisis_flag, language, geo_location, url, keybert_topics, ai_summary
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    str(getattr(row, 'id', f"m-{getattr(row, 'brand', 'unk')}-{count}")),
                    getattr(row, 'brand', 'Unknown'),
                    getattr(row, 'channel', 'Unknown'),
                    getattr(row, 'text', ''),
                    getattr(row, 'author', 'Unknown'),
                    int(getattr(row, 'author_followers', 0)),
                    float(getattr(row, 'author_influence', 0.0)),
                    str(getattr(row, 'published_at', '')),
                    int(getattr(row, 'reach', 0)),
                    int(getattr(row, 'likes', 0)),
                    int(getattr(row, 'shares', 0)),
                    int(getattr(row, 'comments', 0)),
                    float(getattr(row, 'vader_score', 0.0)),
                    str(getattr(row, 'vader_label', 'neutral')),
                    float(getattr(row, 'confidence', 0.5)),
                    str(getattr(row, 'emotion', 'neutral')),
                    str(getattr(row, 'intent', 'neutral_mention')),
                    str(getattr(row, 'aspect', 'general')),
                    int(getattr(row, 'crisis_score', 0)),
                    int(getattr(row, 'crisis_flag', 0)),
                    str(getattr(row, 'language', 'en')),
                    str(getattr(row, 'geo_location', 'Global')),
                    getattr(row, 'url', ''),
                    str(getattr(row, 'keybert_topics', '')),
                    "AI Analysis via ML Pipeline v2"
                ))
                count += 1
            except Exception as e:
                print(f"   Error saving record: {e}")
                
        conn.commit()
        conn.close()
        print(f"✅ ML Synchronized: {count} records analyzed and saved to Database.")
    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    targets = [
        {
            "brand": "Antigravity",
            "youtube_query": "Antigravity Fitness Yoga Workout",
            "reddit_kw": "Antigravity",
            "ig_keyword": "AntigravityFitness",
            "fb_keyword": "AntigravityYoga",
        },
        {
            "brand": "Apple",
            "youtube_query": "Apple iPhone review 2024",
            "reddit_kw": "iPhone",
            "ig_keyword": "iPhone",
            "fb_keyword": "iPhone"
        },
        {
            "brand": "Samsung",
            "youtube_query": "Samsung Galaxy S24 Ultra review",
            "reddit_kw": "Samsung",
            "ig_keyword": "SamsungGalaxy",
            "fb_keyword": "SamsungMobile"
        }
    ]
    run_pipeline(targets, output_file="dashboard/data/processed_mentions.json")
