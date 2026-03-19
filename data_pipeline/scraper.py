import os
import json
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

def fetch_youtube_comments(video_id, brand="Unknown", max_results=100):
    """
    Fetches comments from a specific YouTube video.
    Requires YOUTUBE_API_KEY in .env.
    """
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        print(f"YOUTUBE_API_KEY is not set in environment. Returning mock data for {brand}!")
        return [
            {"id": "1", "brand": brand, "text": "This product is absolutely amazing! I love it.", "author": "User A", "published_at": "2023-10-01", "channel": "youtube", "reach": 150},
            {"id": "2", "brand": brand, "text": "Terrible experience. It broke after two days.", "author": "User B", "published_at": "2023-10-02", "channel": "youtube", "reach": 20},
            {"id": "3", "brand": brand, "text": "Honestly, it's just okay. Nothing special but gets the job done.", "author": "User C", "published_at": "2023-10-03", "channel": "youtube", "reach": 5},
            {"id": "4", "brand": brand, "text": "Best purchase I've made this year. Highly recommend!", "author": "User D", "published_at": "2023-10-04", "channel": "youtube", "reach": 500},
            {"id": "5", "brand": brand, "text": "Don't buy this, total waste of money.", "author": "User E", "published_at": "2023-10-05", "channel": "youtube", "reach": 12}
        ]
    
    youtube = build("youtube", "v3", developerKey=api_key)
    
    comments = []
    
    try:
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=max_results,
            textFormat="plainText"
        )
        response = request.execute()
        
        for item in response.get("items", []):
            comment = item["snippet"]["topLevelComment"]["snippet"]
            comments.append({
                "id": item["id"],
                "brand": brand,
                "text": comment["textDisplay"],
                "author": comment["authorDisplayName"],
                "published_at": comment["publishedAt"],
                "channel": "youtube",
                "reach": comment.get("likeCount", 0) # proxy for reach/impact
            })
    except Exception as e:
        print(f"An error occurred while fetching YouTube comments: {e}")
        
    return comments

if __name__ == "__main__":
    # Test execution
    # Replace with a real video ID to test
    try:
        sample_comments = fetch_youtube_comments("dQw4w9WgXcQ", max_results=10)
        print(f"Fetched {len(sample_comments)} comments.")
        if sample_comments:
            print(f"Sample: {sample_comments[0]}")
    except ValueError as ve:
        print(ve)
