// Checks req.params, req.query and req.body against zod schemas. On success
// the parsed values replace the raw ones, so controllers only see clean
// input with defaults filled in and unknown fields removed.
const validate = (schemas) => (req, res, next) => {
    for (const part of ["params", "query", "body"]) {
        const schema = schemas[part];
        if (!schema) continue;

        const result = schema.safeParse(req[part] ?? {});
        if (!result.success) {
            const issues = result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            }));
            // The frontend shows `error`, `issues` lists every problem
            return res.status(400).json({ error: issues[0].message, issues });
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
