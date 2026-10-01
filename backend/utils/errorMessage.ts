// The message of anything a catch block receives
export const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
