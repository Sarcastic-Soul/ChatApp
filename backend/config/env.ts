// Reads a variable that must be set. Called when it's used rather than at
// import time, so tests and scripts that don't need it still load.
export const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set.`);
    return value;
};
