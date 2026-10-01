import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";

type RequestSchemas = {
    params?: z.ZodType;
    query?: z.ZodType;
    body?: z.ZodType;
};

type Parsed<T> = T extends z.ZodType ? z.output<T> : Record<string, never>;

// The request a controller sees after validate(schemas) has run, with
// params, query and body typed from the same zod schemas
export type ValidatedRequest<S extends RequestSchemas> = Request<
    Parsed<S["params"]>,
    unknown,
    Parsed<S["body"]>,
    Parsed<S["query"]>
>;

const PARTS = ["params", "query", "body"] as const;

// Checks req.params, req.query and req.body against zod schemas. On success
// the parsed values replace the raw ones, so controllers only see clean
// input with defaults filled in and unknown fields removed.
const validate =
    (schemas: RequestSchemas): RequestHandler<any, any, any, any> =>
    (req: Request, res: Response, next: NextFunction) => {
        for (const part of PARTS) {
            const schema = schemas[part];
            if (!schema) continue;

            const result = schema.safeParse(req[part] ?? {});
            if (!result.success) {
                const issues = result.error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                }));
                // The frontend shows `error`, `issues` lists every problem
                res.status(400).json({ error: issues[0].message, issues });
                return;
            }

            // Express 5 makes req.query a getter, so redefine instead of assigning
            Object.defineProperty(req, part, {
                value: result.data,
                writable: true,
                configurable: true,
                enumerable: true,
            });
        }
        next();
    };

export default validate;
