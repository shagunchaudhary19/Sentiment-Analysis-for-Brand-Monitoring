import pandas as pd
import gensim
from gensim import corpora

def extract_keybert_topics(text_list: list, top_n: int = 5) -> list:
    """
    Skipping KeyBERT in Lite mode to avoid HuggingFace dependencies.
    """
    return [[] for _ in text_list]

def build_lda_model(text_list: list, num_topics: int = 3, num_words: int = 4):
    """
    Performs LDA topic modeling on a list of lemmatized texts (strings).
    Returns the topics and their top words.
    """
    if not text_list:
        return []
        
    try:
        # texts must be a list of lists of tokens
        tokenized_texts = [text.split() for text in text_list if isinstance(text, str)]
        
        # Create Dictionary
        id2word = corpora.Dictionary(tokenized_texts)
        
        # Create Corpus (Term Document Frequency)
        corpus = [id2word.doc2bow(text) for text in tokenized_texts]
        
        # Build LDA model
        lda_model = gensim.models.LdaMulticore(
            corpus=corpus,
            id2word=id2word,
            num_topics=num_topics,
            random_state=42,
            passes=10,
            workers=2 # keeping multicore workers light
        )
        
        topics = lda_model.print_topics(num_words=num_words)
        return topics
    except Exception as e:
        print(f"Error performing LDA: {e}")
        return []
