import re
import spacy

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("Downloading spacy model 'en_core_web_sm'...")
    from spacy.cli import download
    download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

def remove_urls(text: str) -> str:
    url_pattern = re.compile(r'https?://\S+|www\.\S+')
    return url_pattern.sub(r'', text)

def remove_special_characters(text: str) -> str:
    # Keep alphanumeric, spaces, and basic punctuation
    return re.sub(r'[^A-Za-z0-9\s.,!?\'\"]', '', text)

def normalize_text(text: str) -> str:
    """
    Lowercases, removes URLs, and special chars
    """
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = remove_urls(text)
    text = remove_special_characters(text)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def tokenize_and_lemmatize(text: str) -> str:
    """
    Uses spaCy for tokenization, removing stop words, and lemmatization.
    Returns a string of space-separated lemmas.
    """
    if not text: return ""
    doc = nlp(text)
    lemmas = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct and token.lemma_.strip()]
    return " ".join(lemmas)

def extract_entities(text: str) -> str:
    """
    Extracts core entities like Organizations, People, and Products.
    """
    if not text: return "[]"
    doc = nlp(text)
    # Filter for standard noun entities
    entities = [ent.text for ent in doc.ents if ent.label_ in ['ORG', 'PRODUCT', 'PERSON', 'GPE']]
    return str(entities)

def preprocess_dataframe(df, text_column="text"):
    """
    Applies normalization, lemmatization, and NER to a DataFrame.
    """
    df["normalized_text"] = df[text_column].apply(normalize_text)
    df["processed_text"] = df["normalized_text"].apply(tokenize_and_lemmatize)
    df["named_entities"] = df["normalized_text"].apply(extract_entities)
    return df
