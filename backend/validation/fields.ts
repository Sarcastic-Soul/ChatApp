import { z } from "zod";

// Building blocks shared by the HTTP and socket schemas

export const objectId = (label: string) =>
    z
        .string({ error: `${label} is required` })
        .regex(/^[a-f\d]{24}$/i, `${label} is not a valid id`);

export const requiredText = (label: string, max: number) =>
    z
        .string({ error: `${label} is required` })
        .trim()
        .min(1, `${label} is required`)
        .max(max, `${label} must be ${max} characters or fewer`);

export const httpsUrl = (label: string) =>
    z.url({ protocol: /^https$/, error: `${label} must be an https link` });
