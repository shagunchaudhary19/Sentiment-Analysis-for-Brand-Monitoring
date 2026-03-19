import os
import pandas as pd
from data_pipeline.scraper import fetch_youtube_comments
from data_pipeline.reddit_scraper import fetch_reddit_comments
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
        print(f"1. Fetching YouTube data for {brand}...")
        yt_data = fetch_youtube_comments(t.get("youtube_id", ""), brand=brand, max_results=25)
        print(f"   Fetching Reddit data for {brand}...")
        rd_data = fetch_reddit_comments("technology", t.get("reddit_kw", ""), brand=brand, limit=25)
        raw_data.extend(yt_data + rd_data)
        
    if not len(raw_data):
        print("No data fetched. Exiting.")
        return
        
    df = pd.DataFrame(raw_data)
    print(f"Fetched {len(df)} initial records.")
    
    # 2. Clean Data
    print("2. Cleaning data...")
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
    print(f"Saved CSV export for PowerBI/Tableau to {csv_file}")
    
    # JSON export
    df.to_json(output_file, orient='records', indent=2)
    print(f"Saved JSON export to {output_file}")
    
    print("--- Pipeline Complete ---")

if __name__ == "__main__":
    # Define tracking targets
    targets = [
        {"brand": "Apple", "youtube_id": "dQw4w9WgXcQ", "reddit_kw": "iPhone"},
        {"brand": "Samsung", "youtube_id": "jNQXAC9IVRw", "reddit_kw": "Galaxy"},
        {"brand": "Google", "youtube_id": "fJ9rUzIMcZQ", "reddit_kw": "Pixel"}
    ]
    run_pipeline(targets, output_file="dashboard/data/processed_mentions.json")
