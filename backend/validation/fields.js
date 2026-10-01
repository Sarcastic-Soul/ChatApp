import { z } from "zod";

// Building blocks shared by the HTTP and socket schemas

export const objectId = (label) =>
    z
        .string({ error: `${label} is required` })
        .regex(/^[a-f\d]{24}$/i, `${label} is not a valid id`);

export const requiredText = (label, max) =>
    z
        .string({ error: `${label} is required` })
        .trim()
        .min(1, `${label} is required`)
        .max(max, `${label} must be ${max} characters or fewer`);

export const httpsUrl = (label) =>
    z.url({ protocol: /^https$/, error: `${label} must be an https link` });
