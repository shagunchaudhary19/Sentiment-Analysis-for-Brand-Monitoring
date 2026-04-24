/**
 * BrandWatch Sentiment Normalizer
 * Ensures consistency between VADER (Python) and Sentiment (Node.js) scores.
 */

function normalizeSentiment(score, source = 'vader') {
    let normalized = score;
    
    if (source === 'vader') {
        // VADER is already -1 to 1
        normalized = Math.max(-1, Math.min(1, score));
    } else if (source === 'node-sentiment') {
        // Node sentiment 'comparative' is roughly -1 to 1 but can vary.
        // We boost it slightly to match VADER's sensitivity.
        normalized = Math.max(-1, Math.min(1, score * 1.5));
    }
    
    let label = 'neutral';
    if (normalized >= 0.1) label = 'positive';
    else if (normalized <= -0.1) label = 'negative';
    
    return { score: normalized, label };
}

module.exports = { normalizeSentiment };
