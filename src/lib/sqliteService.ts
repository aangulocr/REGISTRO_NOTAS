// Servicio oficial para interactuar con SQLite a través del puente Electron (IPC) o API local.
// ÚNICA fuente de verdad para acceso a datos — NO usar supabase ni fetch manual a URLs externas.

interface QueryResult {
    data: any | any[] | null;
    error: string | null;
}

export const sqliteService = {
    // ─── Consulta genérica ──────────────────────────────────────────────────────
    async query(sql: string, params: any[] = []): Promise<QueryResult> {
        if ((window as any).electronAPI) {
            return await (window as any).electronAPI.dbQuery({ sql, params });
        }
        // Fallback para modo web (npm run web)
        try {
            const response = await fetch('http://localhost:3001', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'db-query', payload: { sql, params } })
            });
            return await response.json();
        } catch (error: any) {
            return { data: null, error: `Error de conexión con el servidor local: ${error.message}` };
        }
    },

    // ─── Transacciones atómicas ─────────────────────────────────────────────────
    async transaction(queries: { sql: string; params: any[] }[]): Promise<{ success: boolean; error: string | null }> {
        if ((window as any).electronAPI) {
            return await (window as any).electronAPI.dbTransaction({ queries });
        }
        try {
            const response = await fetch('http://localhost:3001', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'db-transaction', payload: { queries } })
            });
            return await response.json();
        } catch (error: any) {
            return { success: false, error: `Error de conexión con el servidor local: ${error.message}` };
        }
    },

    // ─── API fluida tipo repositorio ────────────────────────────────────────────
    from(table: string) {
        return {
            /** SELECT * FROM table */
            async select(columns: string = '*'): Promise<QueryResult> {
                return sqliteService.query(`SELECT ${columns} FROM ${table}`);
            },

            /** SELECT cols FROM table WHERE key = val */
            async selectWhere(columns: string = '*', key: string, val: any): Promise<QueryResult> {
                return sqliteService.query(
                    `SELECT ${columns} FROM ${table} WHERE ${key} = ?`,
                    [val]
                );
            },

            /** SELECT cols FROM table WHERE key IN (val1, val2, ...) */
            async selectIn(columns: string = '*', key: string, values: any[]): Promise<QueryResult> {
                if (values.length === 0) return { data: [], error: null };
                const placeholders = values.map(() => '?').join(', ');
                return sqliteService.query(
                    `SELECT ${columns} FROM ${table} WHERE ${key} IN (${placeholders})`,
                    values
                );
            },

            /** INSERT INTO table (cols) VALUES (?) */
            async insert(data: Record<string, any>): Promise<QueryResult> {
                const keys = Object.keys(data);
                const values = Object.values(data);
                const placeholders = keys.map(() => '?').join(', ');
                const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
                return sqliteService.query(sql, values);
            },

            /**
             * INSERT INTO table … RETURNING id
             * Devuelve { data: { id: number }, error }
             */
            async insertReturning(data: Record<string, any>): Promise<{ data: { id: number } | null; error: string | null }> {
                const keys = Object.keys(data);
                const values = Object.values(data);
                const placeholders = keys.map(() => '?').join(', ');
                // SQLite no soporta RETURNING, así que insertamos y luego hacemos SELECT last_insert_rowid()
                const insertSql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
                const insertResult = await sqliteService.query(insertSql, values);
                if (insertResult.error) return { data: null, error: insertResult.error };
                const idResult = await sqliteService.query('SELECT last_insert_rowid() as id');
                const id = idResult.data?.[0]?.id ?? null;
                return { data: id !== null ? { id } : null, error: idResult.error };
            },

            /** UPDATE table SET … WHERE filterKey = filterValue */
            async update(data: Record<string, any>, filterKey: string, filterValue: any): Promise<QueryResult> {
                const keys = Object.keys(data);
                const values = Object.values(data);
                const setClause = keys.map(k => `${k} = ?`).join(', ');
                const sql = `UPDATE ${table} SET ${setClause} WHERE ${filterKey} = ?`;
                return sqliteService.query(sql, [...values, filterValue]);
            },

            /** DELETE FROM table WHERE filterKey = filterValue */
            async delete(filterKey: string, filterValue: any): Promise<QueryResult> {
                const sql = `DELETE FROM ${table} WHERE ${filterKey} = ?`;
                return sqliteService.query(sql, [filterValue]);
            },

            /**
             * INSERT … ON CONFLICT(onConflict) DO UPDATE SET …
             * Acepta un único objeto o un array.
             */
            async upsert(
                data: Record<string, any> | Record<string, any>[],
                options?: { onConflict?: string }
            ): Promise<{ success: boolean; error: string | null }> {
                const items = Array.isArray(data) ? data : [data];
                const onConflict = options?.onConflict ?? '';

                const queries = items.map(item => {
                    const keys = Object.keys(item);
                    const placeholders = keys.map(() => '?').join(', ');
                    let sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

                    if (onConflict) {
                        const updateClause = keys
                            .filter(k => !onConflict.split(',').map(s => s.trim()).includes(k))
                            .map(k => `${k} = excluded.${k}`)
                            .join(', ');
                        sql += ` ON CONFLICT(${onConflict}) DO UPDATE SET ${updateClause}`;
                    }

                    return { sql, params: Object.values(item) as any[] };
                });

                if (queries.length === 1) {
                    const result = await sqliteService.query(queries[0].sql, queries[0].params);
                    return { success: !result.error, error: result.error };
                }
                return sqliteService.transaction(queries);
            }
        };
    }
};
