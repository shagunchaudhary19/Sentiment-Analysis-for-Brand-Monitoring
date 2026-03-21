import os
import json
import urllib.request
import urllib.error
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

def fetch_instagram_mentions(keyword: str, brand: str = "Unknown", limit: int = 25):
    """
    Fetches Instagram media/posts mentioning a keyword using the Instagram Graph API.
    Requires INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID in .env.

    Falls back to realistic mock data if credentials are not set.

    API Docs:
      - Hashtag Search: https://developers.facebook.com/docs/instagram-api/reference/ig-hashtag-search
      - Media: https://developers.facebook.com/docs/instagram-api/reference/ig-hashtag/recent-media
    """
    access_token = os.getenv("INSTAGRAM_ACCESS_TOKEN")
    user_id = os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID")

    if not access_token or not user_id:
        print(f"[Instagram] Credentials not set (INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID). "
              f"Using mock data for '{brand}'.")
        return _mock_instagram_data(keyword, brand, limit)

    posts = []

    try:
        # Step 1: Get hashtag ID
        hashtag_query = keyword.replace(" ", "").lower()
        search_url = (
            f"https://graph.facebook.com/v19.0/ig_hashtag_search"
            f"?user_id={user_id}"
            f"&q={urllib.parse.quote(hashtag_query)}"
            f"&access_token={access_token}"
        )
        req = urllib.request.Request(search_url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            hashtag_id = data.get("data", [{}])[0].get("id")

        if not hashtag_id:
            print(f"[Instagram] No hashtag found for '{hashtag_query}'. Using mock data.")
            return _mock_instagram_data(keyword, brand, limit)

        # Step 2: Fetch recent media for that hashtag
        media_url = (
            f"https://graph.facebook.com/v19.0/{hashtag_id}/recent_media"
            f"?user_id={user_id}"
            f"&fields=id,caption,timestamp,like_count,comments_count"
            f"&access_token={access_token}"
            f"&limit={min(limit, 50)}"
        )
        req = urllib.request.Request(media_url)
        with urllib.request.urlopen(req) as resp:
            media_data = json.loads(resp.read().decode())

        for item in media_data.get("data", []):
            caption = item.get("caption", "")
            posts.append({
                "id": item.get("id", ""),
                "brand": brand,
                "text": caption[:500] if caption else f"#{hashtag_query}",
                "author": "instagram_user",
                "published_at": item.get("timestamp", ""),
                "channel": "instagram",
                "reach": item.get("like_count", 0) + item.get("comments_count", 0) * 3
            })

    except urllib.error.HTTPError as e:
        print(f"[Instagram] HTTP error {e.code}: {e.reason}. Using mock data.")
        return _mock_instagram_data(keyword, brand, limit)
    except Exception as e:
        print(f"[Instagram] Unexpected error: {e}. Using mock data.")
        return _mock_instagram_data(keyword, brand, limit)

    if not posts:
        print(f"[Instagram] No posts returned for '{keyword}'. Using mock data.")
        return _mock_instagram_data(keyword, brand, limit)

    return posts[:limit]


def _mock_instagram_data(keyword: str, brand: str, limit: int = 5):
    """Returns realistic mock Instagram posts for offline/no-key usage."""
    from datetime import datetime, timedelta
    import random
    now = datetime.utcnow()
    
    base = [
        {
            "id": "ig1",
            "brand": brand,
            "text": f"Obsessed with my new {keyword} purchase! The quality is next level 😍 #unboxing #{keyword.replace(' ','')}",
            "author": "lifestyle_by_mia",
            "published_at": (now - timedelta(hours=random.randint(2, 8))).isoformat() + "Z",
            "channel": "instagram",
            "reach": 3420
        },
        {
            "id": "ig2",
            "brand": brand,
            "text": f"Honestly, {keyword} disappointed me this time. The build quality feels cheap for the price. #techreview",
            "author": "gadget_reviewer_99",
            "published_at": (now - timedelta(days=random.randint(1, 2))).isoformat() + "Z",
            "channel": "instagram",
            "reach": 890
        },
        {
            "id": "ig3",
            "brand": brand,
            "text": f"My {keyword} aesthetic setup is finally complete ✨ Drop a 🔥 if you love it! #setup #deskgoals",
            "author": "minimal_desk_vibes",
            "published_at": (now - timedelta(days=random.randint(4, 10))).isoformat() + "Z",
            "channel": "instagram",
            "reach": 12500
        },
        {
            "id": "ig4",
            "brand": brand,
            "text": f"Not sponsored, just genuinely love {keyword}. Been using it daily for 3 months and zero complaints! #honest",
            "author": "tech_honest_reviews",
            "published_at": (now - timedelta(hours=random.randint(12, 48))).isoformat() + "Z",
            "channel": "instagram",
            "reach": 2100
        },
        {
            "id": "ig5",
            "brand": brand,
            "text": f"The new {keyword} update is a vibe. Super smooth experience! Who else noticed the performance boost? 🚀",
            "author": "daily_tech_drop",
            "published_at": (now - timedelta(minutes=random.randint(30, 600))).isoformat() + "Z",
            "channel": "instagram",
            "reach": 567
        },
    ]
    return base[:limit]


if __name__ == "__main__":
    results = fetch_instagram_mentions("iPhone", brand="Apple", limit=5)
    print(f"Fetched {len(results)} Instagram posts.")
    for r in results:
        print(r)
