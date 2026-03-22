import os
import requests
import json
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

def send_slack_alert(brand: str, metric: str, value: float, threshold: float, message: str):
    """
    Sends an alert to a configured Slack webhook.
    """
    if not SLACK_WEBHOOK_URL:
        # If no webhook is configured, fallback to console logging a simulated alert
        print(f"\n🚨  [MOCK ALERT]  🚨 CRITICAL INCIDENT FOR {brand.upper()}")
        print(f"Target: {metric}")
        print(f"Current Value: {value} (Threshold: {threshold})")
        print(f"Details: {message}\n")
        return

    payload = {
        "text": f"🚨 *BRAND SENTIMENT ALERT: {brand}* 🚨",
        "attachments": [
            {
                "color": "#f43f5e", # Rose-500 red color
                "fields": [
                    {
                        "title": "Alert Type",
                        "value": f"{metric}",
                        "short": True
                    },
                    {
                        "title": "Current Value",
                        "value": f"{value:.2f} (Threshold: {threshold:.2f})",
                        "short": True
                    },
                    {
                        "title": "Details",
                        "value": message,
                        "short": False
                    }
                ],
                "footer": "Brand Sentiment Monitor AI",
                "ts": pd.Timestamp.utcnow().timestamp()
            }
        ]
    }

    try:
        response = requests.post(
            SLACK_WEBHOOK_URL, 
            data=json.dumps(payload),
            headers={'Content-Type': 'application/json'}
        )
        if response.status_code != 200:
            print(f"Failed to send Slack alert. Status Code: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"Exception during Slack alert dispatch: {e}")

def check_for_alerts(df):
    """
    Evaluates new scraped data against thresholds and triggers alerts.
    """
    if df.empty:
        return
        
    print("\n--- Running Alert Rules Engine ---")
    
    # Analyze by brand
    for brand, group in df.groupby("brand"):
        mention_count = len(group)
        # Check rule 1: Mentions spike
        # We lower the default condition for prototype purposes (50 -> 40)
        if mention_count > 40:
             send_slack_alert(
                 brand=brand, 
                 metric="Mention Volume Spike", 
                 value=float(mention_count),
                 threshold=40.0, 
                 message=f"High discussion volume detected for {brand}."
             )
             
        # Check rule 2: Sudden Sentiment Drop
        if "vader_score" in group.columns:
            avg_score = group["vader_score"].mean()
            # If the sentiment is very critical: (< -0.1 as threshold for mock purposes)
            if avg_score < -0.1:
                send_slack_alert(
                    brand=brand, 
                    metric="Critical Sentiment Drop", 
                    value=float(avg_score), 
                    threshold=-0.1, 
                    message=f"Sentiment for {brand} is largely negative in the latest batch. Immediate check advised!"
                )
