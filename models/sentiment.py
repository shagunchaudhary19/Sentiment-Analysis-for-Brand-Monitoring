import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import warnings

warnings.filterwarnings('ignore')

# Initialize VADER
vader_analyzer = SentimentIntensityAnalyzer()

def get_vader_sentiment(text: str) -> dict:
    """Returns the compound score and label for VADER."""
    if not isinstance(text, str) or not text.strip():
        return {"score": 0.0, "label": "neutral"}
        
    scores = vader_analyzer.polarity_scores(text)
    compound = scores['compound']
    
    if compound >= 0.05:
        label = 'positive'
    elif compound <= -0.05:
        label = 'negative'
    else:
        label = 'neutral'
        
    return {"score": compound, "label": label}

def analyze_dataframe(df: pd.DataFrame, text_column: str = "processed_text") -> pd.DataFrame:
    """
    Applies VADER to a DataFrame (Lite version skips transformers).
    """
    print("Running VADER Sentiment Analysis...")
    vader_results = df[text_column].apply(get_vader_sentiment)
    df["vader_label"] = vader_results.apply(lambda x: x["label"])
    df["vader_score"] = vader_results.apply(lambda x: x["score"])
    
    return df
