import os
import pandas as pd
from data_pipeline.scraper import fetch_youtube_comments
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

        raw_data.extend(yt_data + rd_data + ig_data + fb_data)
        
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
    lda_topics = build_lda_model(df['processed_text'].tolist(), num_topics=3, num_words=4)
    print("LDA Global Topics:", lda_topics)
    
    # 6. Save Data
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # CSV export for PowerBI/Tableau
    csv_file = output_file.replace(".json", ".csv")
    df.to_csv(csv_file, index=False)
    print(f"\nSaved CSV export to {csv_file}")
    
    # JSON export (kept for backwards compatibility)
    df.to_json(output_file, orient='records', indent=2)
    print(f"Saved JSON export to {output_file}")

    # 7. Database Persistence
    import sqlite3
    db_path = "database/mentions.db"
    try:
        conn = sqlite3.connect(db_path)
        # Using itertuples for faster DB insertion
        for row in df.itertuples():
            conn.execute('''
                INSERT OR REPLACE INTO mentions (
                    id, brand, channel, text, author, published_at, reach, vader_score, vader_label
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(getattr(row, 'id', '')),
                getattr(row, 'brand', 'Unknown'),
                getattr(row, 'channel', 'Unknown'),
                getattr(row, 'text', ''),
                getattr(row, 'author', 'Unknown'),
                str(getattr(row, 'published_at', '')),
                int(getattr(row, 'reach', 0)),
                float(getattr(row, 'vader_score', 0.0)),
                str(getattr(row, 'vader_label', 'neutral'))
            ))
        conn.commit()
        print(f"✅ Successfully persisted {len(df)} records to SQLite database ({db_path}).")
        conn.close()
    except Exception as e:
        print(f"❌ Error persisting to database: {e}")

    # Print channel breakdown summary
    if "channel" in df.columns:
        print("\n--- Platform Breakdown ---")
        print(df["channel"].value_counts().to_string())
    
    print("\n--- Pipeline Complete ---")

if __name__ == "__main__":
    # Define tracking targets
    # youtube_query: search term for YouTube Search API
    # reddit_kw:     keyword to search on Reddit
    # ig_keyword:    hashtag/keyword for Instagram Graph API
    # fb_keyword:    keyword to filter Facebook Page posts
    targets = [
        {
            "brand": "Apple",
            "youtube_query": "Apple iPhone review 2024",
            "reddit_kw": "iPhone",
            "ig_keyword": "iPhone",
            "fb_keyword": "iPhone"
        },
        {
            "brand": "Samsung",
            "youtube_query": "Samsung Galaxy review 2024",
            "reddit_kw": "Galaxy",
            "ig_keyword": "Samsung",
            "fb_keyword": "Galaxy"
        },
        {
            "brand": "Google",
            "youtube_query": "Google Pixel review 2024",
            "reddit_kw": "Pixel",
            "ig_keyword": "GooglePixel",
            "fb_keyword": "Pixel"
        }
    ]
    run_pipeline(targets, output_file="dashboard/data/processed_mentions.json")
