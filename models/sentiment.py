import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import warnings

warnings.filterwarnings('ignore')

# Initialize Analyzers
vader_analyzer = SentimentIntensityAnalyzer()

_sentiment_pipeline = None

def get_transformer_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        try:
            from transformers import pipeline
            print("Loading Transformer Sentiment Pipeline (DistilBERT)...")
            _sentiment_pipeline = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
        except Exception as e:
            print(f"Transformers not available, falling back to VADER: {e}")
            _sentiment_pipeline = "vader"
    return _sentiment_pipeline

def get_vader_sentiment(text: str) -> dict:
    """Returns the compound score and label for VADER."""
    if not isinstance(text, str) or not text.strip():
        return {"score": 0.0, "label": "neutral"}
    scores = vader_analyzer.polarity_scores(text)
    compound = scores['compound']
    label = 'positive' if compound >= 0.05 else ('negative' if compound <= -0.05 else 'neutral')
    return {"score": compound, "label": label}

def analyze_dataframe(df: pd.DataFrame, text_column: str = "processed_text") -> pd.DataFrame:
    """
    Applies Hybrid Sentiment Analysis (Transformer + VADER).
    """
    pipe = get_transformer_pipeline()
    
    if pipe == "vader":
        print("Running VADER Sentiment Analysis...")
        vader_results = df[text_column].apply(get_vader_sentiment)
        df["vader_label"] = vader_results.apply(lambda x: x["label"])
        df["vader_score"] = vader_results.apply(lambda x: x["score"])
    else:
        print("Running Transformer Sentiment Analysis...")
        # For simplicity in batch, we apply to text directly
        results = []
        for text in df[text_column].fillna("").tolist():
            try:
                # Transformers result: [{'label': 'POSITIVE', 'score': 0.99}]
                res = pipe(text[:512])[0]
                score = res['score'] if res['label'] == 'POSITIVE' else -res['score']
                results.append({"label": res['label'].lower(), "score": score})
            except:
                results.append(get_vader_sentiment(text))
        
        df["vader_label"] = [r["label"] for r in results]
        df["vader_score"] = [r["score"] for r in results]
    
    return df
