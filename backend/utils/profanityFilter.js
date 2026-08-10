import filter from "leo-profanity";

// Load default English dictionary
filter.loadDictionary("en");

/**
 * Sanitizes input text by replacing profanity with asterisks (soft masking).
 * @param {string} text - The input message string to sanitize
 * @returns {string} - The sanitized text
 */
export const cleanProfanity = (text) => {
    if (!text || typeof text !== "string") return text;
    try {
        return filter.clean(text);
    } catch (error) {
        console.error("Error in profanity filter:", error);
        return text;
    }
};
