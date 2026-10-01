import filter from "leo-profanity";

// Load default English dictionary
filter.loadDictionary("en");

// Replaces profanity with asterisks (soft masking)
export const cleanProfanity = <T extends string | null | undefined>(text: T): T | string => {
    if (!text || typeof text !== "string") return text;
    try {
        return filter.clean(text);
    } catch (error) {
        console.error("Error in profanity filter:", error);
        return text;
    }
};
