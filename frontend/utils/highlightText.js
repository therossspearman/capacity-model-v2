/**
 * highlightText - Utility to highlight matching search terms in text
 * Returns a React element with highlighted spans
 */
import React from 'react';

/**
 * Highlights matching text with a yellow background
 * @param {string} text - The full text to display
 * @param {string} searchTerm - The term to highlight
 * @param {object} options - Styling options
 * @returns {React.ReactNode} - Text with highlighted portions
 */
export const highlightText = (text, searchTerm, options = {}) => {
    if (!text || !searchTerm || typeof text !== 'string') {
        return text;
    }

    const {
        highlightStyle = {
            backgroundColor: '#fef08a',
            padding: '0 2px',
            borderRadius: '2px',
            color: '#854d0e'
        }
    } = options;

    const lowerText = text.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase().trim();

    if (!lowerSearch || !lowerText.includes(lowerSearch)) {
        return text;
    }

    const parts = [];
    let lastIndex = 0;
    let searchIndex = lowerText.indexOf(lowerSearch);

    while (searchIndex !== -1) {
        // Add text before match
        if (searchIndex > lastIndex) {
            parts.push(text.substring(lastIndex, searchIndex));
        }

        // Add highlighted match (preserve original case)
        parts.push(
            <span key={searchIndex} style={highlightStyle}>
                {text.substring(searchIndex, searchIndex + lowerSearch.length)}
            </span>
        );

        lastIndex = searchIndex + lowerSearch.length;
        searchIndex = lowerText.indexOf(lowerSearch, lastIndex);
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
};

export default highlightText;
