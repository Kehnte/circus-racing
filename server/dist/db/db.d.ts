import * as schema from "./schema.js";
export declare const db: import("drizzle-orm/libsql/driver-core.js").LibSQLDatabase<typeof schema> & {
    $client: {
        connection: {
            url: string;
        };
        schema: typeof schema;
    };
};
//# sourceMappingURL=db.d.ts.map