import pandas as pd

def clean_data(df: pd.DataFrame, text_column: str = "text") -> pd.DataFrame:
    """
    Cleans raw social media data.
    - Removes duplicates based on the text column.
    - Drops rows where the text is null or perfectly empty.
    """
    if text_column not in df.columns:
        raise ValueError(f"Column '{text_column}' not found in dataframe")
        
    initial_len = len(df)
    
    # Drop rows with null text
    df = df.dropna(subset=[text_column])
    
    # Drop empty strings
    df = df[df[text_column].astype(str).str.strip() != ""]
    
    # Drop duplicates
    df = df.drop_duplicates(subset=[text_column])
    
    final_len = len(df)
    print(f"Cleaned data: dropped {initial_len - final_len} rows.")
    
    return df
