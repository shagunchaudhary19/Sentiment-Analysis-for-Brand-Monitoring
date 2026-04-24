import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_keybert_topics(text_list: list, top_n: int = 3) -> list:
    """
    Extracts keywords for each text in the list using KeyBERT.
    """
    if not text_list:
        return []
        
    try:
        from keybert import KeyBERT
        logger.info("Loading KeyBERT Model...")
        kw_model = KeyBERT()
        
        results = []
        for text in text_list:
            if not isinstance(text, str) or not text.strip():
                results.append("")
                continue
            # extract_keywords returns list of (keyword, score)
            keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english', top_n=top_n)
            results.append(", ".join([k[0] for k in keywords]))
        return results
    except Exception as e:
        logger.warning(f"KeyBERT not available, returning empty topics: {e}")
        return ["" for _ in text_list]

def build_lda_model(text_list: list, num_topics: int = 3, num_words: int = 4):
    """
    Performs LDA topic modeling on a list of lemmatized texts (strings).
    Returns the topics and their top words.
    """
    if not text_list:
        return []
        
    try:
        import gensim
        from gensim import corpora
        
        # texts must be a list of lists of tokens
        tokenized_texts = [text.split() for text in text_list if isinstance(text, str) and text.strip()]
        if not tokenized_texts:
            return []

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
        logger.error(f"Error performing LDA: {e}")
        return []
