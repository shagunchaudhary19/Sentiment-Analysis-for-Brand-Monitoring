import os
import json
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

def fetch_youtube_comments(query: str, brand: str = "Unknown", max_results: int = 25):
    """
    Searches for YouTube videos about a brand/keyword and returns snippets as 'mentions'.
    Uses the YouTube Data API v3 Search endpoint.
    Requires YOUTUBE_API_KEY in .env.

    Falls back to realistic mock data if the API key is not set.
    """
    api_key = os.getenv("YOUTUBE_API_KEY")

    if not api_key or api_key == "your_youtube_api_key_here":
        print(f"[YouTube] YOUTUBE_API_KEY is not set. Using mock data for '{brand}'.")
        return _mock_youtube_data(query, brand, max_results)

    mentions = []

    try:
        youtube = build("youtube", "v3", developerKey=api_key)

        # Search for recent videos mentioning the brand/keyword
        request = youtube.search().list(
            part="snippet",
            q=query,
            type="video",
            order="date",
            maxResults=min(max_results, 50),
            relevanceLanguage="en"
        )
        response = request.execute()

        for item in response.get("items", []):
            snippet = item.get("snippet", {})
            video_id = item.get("id", {}).get("videoId", "")
            title = snippet.get("title", "")
            description = snippet.get("description", "")
            text = f"{title}. {description[:200]}".strip()

            mentions.append({
                "id": video_id or item.get("id", {}).get("channelId", ""),
                "brand": brand,
                "text": text,
                "author": snippet.get("channelTitle", "Unknown"),
                "published_at": snippet.get("publishedAt", ""),
                "channel": "youtube",
                "reach": 0  # view count requires a separate Videos.list call
            })

    except Exception as e:
        print(f"[YouTube] API error: {e}. Using mock data.")
        return _mock_youtube_data(query, brand, max_results)

    if not mentions:
        print(f"[YouTube] No results for '{query}'. Using mock data.")
        return _mock_youtube_data(query, brand, max_results)

    return mentions


def _mock_youtube_data(keyword: str, brand: str, limit: int = 5):
    """Returns realistic mock YouTube video snippets for offline/no-key usage."""
    from datetime import datetime, timedelta
    import random
    
    now = datetime.utcnow()
    
    base = [
        {
            "id": "yt_mock_1",
            "brand": brand,
            "text": f"{keyword} Review 2026 - Is it ACTUALLY worth it? "
                    f"This product is absolutely amazing! Incredible build quality and performance.",
            "author": "TechWithMax",
            "published_at": (now - timedelta(hours=random.randint(1, 10))).isoformat() + "Z",
            "channel": "youtube",
            "reach": 150000
        },
        {
            "id": "yt_mock_2",
            "brand": brand,
            "text": f"Honest {keyword} Review After 6 Months - "
                    f"I have some concerns about the durability. It broke after heavy use.",
            "author": "HonestTechReviews",
            "published_at": (now - timedelta(days=random.randint(1, 3))).isoformat() + "Z",
            "channel": "youtube",
            "reach": 20000
        },
        {
            "id": "yt_mock_3",
            "brand": brand,
            "text": f"Top 5 Things I LOVE About {keyword} in 2026 - "
                    f"Best purchase I've made this year. Highly recommend to everyone!",
            "author": "GadgetGuru",
            "published_at": (now - timedelta(days=random.randint(5, 15))).isoformat() + "Z",
            "channel": "youtube",
            "reach": 500000
        },
        {
            "id": "yt_mock_4",
            "brand": brand,
            "text": f"Don't Buy {keyword} Before Watching This! "
                    f"It's an average product, nothing special but it gets the job done.",
            "author": "BudgetTechFan",
            "published_at": (now - timedelta(minutes=random.randint(10, 500))).isoformat() + "Z",
            "channel": "youtube",
            "reach": 5000
        },
        {
            "id": "yt_mock_5",
            "brand": brand,
            "text": f"{keyword} vs The Competition - Full Comparison 2026. "
                    f"Terrible experience with customer service. Total waste of money, do not buy.",
            "author": "CompareEverything",
            "published_at": (now - timedelta(hours=random.randint(20, 100))).isoformat() + "Z",
            "channel": "youtube",
            "reach": 12000
        },
    ]
    return base[:limit]


if __name__ == "__main__":
    results = fetch_youtube_comments("iPhone 15", brand="Apple", max_results=10)
    print(f"Fetched {len(results)} YouTube mentions.")
    if results:
        print(f"Sample: {results[0]}")
