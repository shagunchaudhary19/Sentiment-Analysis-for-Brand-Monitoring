import os
import json
import urllib.request
import urllib.error
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

def fetch_facebook_posts(keyword: str, brand: str = "Unknown", limit: int = 25):
    """
    Fetches public Facebook Page posts related to a keyword using the Facebook Graph API.
    Requires FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID in .env.

    Falls back to realistic mock data if credentials are not set.

    API Docs:
      - Page Feed: https://developers.facebook.com/docs/graph-api/reference/page/feed/
      - Keyword Search: https://developers.facebook.com/docs/graph-api/reference/v19.0/search
    """
    access_token = os.getenv("FACEBOOK_ACCESS_TOKEN")
    page_id = os.getenv("FACEBOOK_PAGE_ID")

    if not access_token or not page_id:
        print(f"[Facebook] Credentials not set (FACEBOOK_ACCESS_TOKEN / FACEBOOK_PAGE_ID). "
              f"Using mock data for '{brand}'.")
        return _mock_facebook_data(keyword, brand, limit)

    posts = []

    try:
        # Fetch posts from the brand's Page feed
        feed_url = (
            f"https://graph.facebook.com/v19.0/{page_id}/feed"
            f"?fields=id,message,story,created_time,likes.summary(true),comments.summary(true)"
            f"&limit={min(limit, 100)}"
            f"&access_token={access_token}"
        )
        req = urllib.request.Request(feed_url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())

        for item in data.get("data", []):
            text = item.get("message") or item.get("story", "")
            # Filter to keyword-relevant posts
            if keyword.lower() not in text.lower() and brand.lower() not in text.lower():
                continue
            likes = item.get("likes", {}).get("summary", {}).get("total_count", 0)
            comments = item.get("comments", {}).get("summary", {}).get("total_count", 0)
            posts.append({
                "id": item.get("id", ""),
                "brand": brand,
                "text": text[:500],
                "author": brand,
                "published_at": item.get("created_time", ""),
                "channel": "facebook",
                "reach": likes + comments * 5
            })

    except urllib.error.HTTPError as e:
        print(f"[Facebook] HTTP error {e.code}: {e.reason}. Using mock data.")
        return _mock_facebook_data(keyword, brand, limit)
    except Exception as e:
        print(f"[Facebook] Unexpected error: {e}. Using mock data.")
        return _mock_facebook_data(keyword, brand, limit)

    if not posts:
        print(f"[Facebook] No posts found for '{keyword}'. Using mock data.")
        return _mock_facebook_data(keyword, brand, limit)

    return posts[:limit]


def _mock_facebook_data(keyword: str, brand: str, limit: int = 5):
    """Returns realistic mock Facebook posts for offline/no-key usage."""
    from datetime import datetime, timedelta
    import random
    now = datetime.utcnow()
    
    base = [
        {
            "id": "fb1",
            "brand": brand,
            "text": f"The new {keyword} launch has everyone talking! Drop your thoughts below 👇 Have you tried it yet?",
            "author": f"{brand} Official",
            "published_at": (now - timedelta(hours=random.randint(1, 5))).isoformat() + "Z",
            "channel": "facebook",
            "reach": 5800
        },
        {
            "id": "fb2",
            "brand": brand,
            "text": f"Sharing my honest 30-day review of {keyword}. The good: great battery life, solid build. "
                    f"The bad: the software still needs work. Overall 7/10.",
            "author": "TechTalk Community",
            "published_at": (now - timedelta(days=random.randint(1, 4))).isoformat() + "Z",
            "channel": "facebook",
            "reach": 1450
        },
        {
            "id": "fb3",
            "brand": brand,
            "text": f"Just switched from a competitor to {keyword} and I am BLOWN AWAY by the difference. "
                    f"Never going back. Highly recommend!",
            "author": "Sarah M.",
            "published_at": (now - timedelta(hours=random.randint(8, 24))).isoformat() + "Z",
            "channel": "facebook",
            "reach": 320
        },
        {
            "id": "fb4",
            "brand": brand,
            "text": f"Customer support for {keyword} is terrible. Been waiting 2 weeks for a response. "
                    f"Very disappointed. Will not be buying again.",
            "author": "James K.",
            "published_at": (now - timedelta(days=random.randint(5, 12))).isoformat() + "Z",
            "channel": "facebook",
            "reach": 78
        },
        {
            "id": "fb5",
            "brand": brand,
            "text": f"Anyone else excited about the upcoming {keyword} announcement? "
                    f"The leaks look promising! 🔥 Tag a friend who needs to know about this.",
            "author": "Tech Enthusiasts Group",
            "published_at": (now - timedelta(minutes=random.randint(15, 300))).isoformat() + "Z",
            "channel": "facebook",
            "reach": 2300
        },
    ]
    return base[:limit]


if __name__ == "__main__":
    results = fetch_facebook_posts("iPhone", brand="Apple", limit=5)
    print(f"Fetched {len(results)} Facebook posts.")
    for r in results:
        print(r)
