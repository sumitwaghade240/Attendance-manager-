// ============================================================================
// Database & Cloud Service Adapter Layer for AttendEase
// PostgreSQL Data Access via Real Supabase Client with Row Level Security
// ============================================================================

let dbInitialized = false;

async function initializeDatabase() {
    if (dbInitialized) return;

    if (typeof initSupabase === 'function') {
        initSupabase();
    }

    dbInitialized = true;
}

// Select helper
async function select(tableOrQuery, params = []) {
    if (!supabaseClient) {
        if (typeof initSupabase === 'function') initSupabase();
    }
    if (!supabaseClient) {
        console.warn(`Supabase not connected. Query on ${tableOrQuery} skipped.`);
        return [];
    }

    // Direct table query mapping
    if (typeof tableOrQuery === 'string' && !tableOrQuery.trim().toUpperCase().startsWith('SELECT')) {
        const { data, error } = await supabaseClient.from(tableOrQuery).select('*');
        if (error) {
            console.error(`Select error on ${tableOrQuery}:`, error.message);
            return [];
        }
        return data || [];
    }

    // SQL statement parser
    const sql = tableOrQuery.trim();
    const extractTableName = (statement) => {
        const match = statement.match(/FROM\s+([a-zA-Z0-9_]+)/i);
        return match ? match[1] : '';
    };

    const tableName = extractTableName(sql);
    if (!tableName) return [];

    const tableMap = {
        'classes': 'academic_classes',
        'academicclasses': 'academic_classes',
        'attendancelogs': 'attendance_sessions',
        'attendancesessions': 'attendance_sessions',
        'attendancerecords': 'attendance_records',
        'users': 'profiles',
        'profiles': 'profiles',
        'students': 'students',
        'departments': 'departments',
        'subjects': 'subjects',
        'auditlogs': 'audit_logs',
        'teacherassignments': 'teacher_assignments'
    };

    const targetTable = tableMap[tableName.toLowerCase()] || tableName.toLowerCase();
    let queryBuilder = supabaseClient.from(targetTable).select('*');

    // Parse WHERE clause
    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:ORDER\s+BY|LIMIT|$)/i);
    if (whereMatch) {
        const whereClause = whereMatch[1].trim();
        const conditions = whereClause.split(/\s+AND\s+/i);
        let paramIdx = 0;

        for (const cond of conditions) {
            const cleanCond = cond.trim();
            const colMatch = /([a-zA-Z0-9_]+)\s*=\s*\?/i.exec(cleanCond);
            const inMatch = /([a-zA-Z0-9_]+)\s+IN\s*\(([^)]+)\)/i.exec(cleanCond);

            if (colMatch && params[paramIdx] !== undefined) {
                let col = colMatch[1];
                if (col.toLowerCase() === 'classid') col = 'class_id';
                if (col.toLowerCase() === 'logid') col = 'session_id';
                if (col.toLowerCase() === 'studentid') col = 'student_id';
                if (col.toLowerCase() === 'submittedby') col = 'submitted_by_name';
                if (col.toLowerCase() === 'username') col = 'email';
                
                queryBuilder = queryBuilder.eq(col, params[paramIdx]);
                paramIdx++;
            } else if (inMatch) {
                let col = inMatch[1];
                if (col.toLowerCase() === 'classid') col = 'class_id';
                if (col.toLowerCase() === 'logid') col = 'session_id';
                if (col.toLowerCase() === 'studentid') col = 'student_id';

                const placeholdersCount = inMatch[2].split(',').length;
                const inVals = params.slice(paramIdx, paramIdx + placeholdersCount);
                paramIdx += placeholdersCount;
                queryBuilder = queryBuilder.in(col, inVals);
            }
        }
    }

    const { data, error } = await queryBuilder;
    if (error) {
        console.error(`Select query failed on ${targetTable}:`, error.message);
        return [];
    }
    return data || [];
}

async function selectOne(tableOrQuery, params = []) {
    const rows = await select(tableOrQuery, params);
    return rows && rows.length > 0 ? rows[0] : null;
}

async function insert(table, data) {
    if (!supabaseClient) {
        if (typeof initSupabase === 'function') initSupabase();
    }
    if (!supabaseClient) {
        throw new Error('Cloud database not connected.');
    }

    const tableMap = {
        'classes': 'academic_classes',
        'attendancelogs': 'attendance_sessions',
        'attendancerecords': 'attendance_records',
        'users': 'profiles',
        'auditlogs': 'audit_logs'
    };

    const targetTable = tableMap[table.toLowerCase()] || table.toLowerCase();
    
    // Normalize keys
    const rowData = {};
    for (const [key, val] of Object.entries(data)) {
        let cleanKey = key;
        if (key === 'classId') cleanKey = 'class_id';
        if (key === 'logId') cleanKey = 'session_id';
        if (key === 'studentId') cleanKey = 'student_id';
        if (key === 'startTime') cleanKey = 'start_time';
        if (key === 'endTime') cleanKey = 'end_time';
        if (key === 'submittedBy') cleanKey = 'submitted_by_name';
        if (key === 'alertsEnabled') cleanKey = 'alerts_enabled';
        if (key === 'departmentId') cleanKey = 'department_id';
        rowData[cleanKey] = val;
    }

    const { data: res, error } = await supabaseClient.from(targetTable).insert(rowData).select();
    if (error) {
        console.error(`Insert failed on ${targetTable}:`, error.message);
        throw error;
    }
    return res;
}

async function update(table, data, whereClause, whereArgs = []) {
    if (!supabaseClient) {
        if (typeof initSupabase === 'function') initSupabase();
    }
    if (!supabaseClient) {
        throw new Error('Cloud database not connected.');
    }

    const tableMap = {
        'classes': 'academic_classes',
        'attendancelogs': 'attendance_sessions',
        'attendancerecords': 'attendance_records',
        'users': 'profiles',
        'students': 'students',
        'departments': 'departments'
    };

    const targetTable = tableMap[table.toLowerCase()] || table.toLowerCase();

    const updates = {};
    for (const [k, v] of Object.entries(data)) {
        let col = k;
        if (k === 'alertsEnabled') col = 'alerts_enabled';
        if (k === 'programType') col = 'program_type';
        updates[col] = v;
    }

    let queryBuilder = supabaseClient.from(targetTable).update(updates);

    const colMatch = /([a-zA-Z0-9_]+)\s*=\s*\?/i.exec(whereClause);
    if (colMatch && whereArgs.length > 0) {
        let col = colMatch[1];
        if (col.toLowerCase() === 'username') col = 'email';
        queryBuilder = queryBuilder.eq(col, whereArgs[0]);
    }

    const { data: res, error } = await queryBuilder.select();
    if (error) {
        console.error(`Update failed on ${targetTable}:`, error.message);
        throw error;
    }
    return res;
}

async function deleteRow(table, whereClause, whereArgs = []) {
    if (!supabaseClient) {
        if (typeof initSupabase === 'function') initSupabase();
    }
    if (!supabaseClient) {
        throw new Error('Cloud database not connected.');
    }

    const tableMap = {
        'classes': 'academic_classes',
        'students': 'students',
        'attendancelogs': 'attendance_sessions',
        'attendancerecords': 'attendance_records',
        'departments': 'departments'
    };

    const targetTable = tableMap[table.toLowerCase()] || table.toLowerCase();
    let queryBuilder = supabaseClient.from(targetTable).delete();

    const colMatch = /([a-zA-Z0-9_]+)\s*=\s*\?/i.exec(whereClause);
    if (colMatch && whereArgs.length > 0) {
        const col = colMatch[1];
        queryBuilder = queryBuilder.eq(col, whereArgs[0]);
    }

    const { data: res, error } = await queryBuilder.select();
    if (error) {
        console.error(`Delete failed on ${targetTable}:`, error.message);
        throw error;
    }
    return res;
}

// Audit logging service
async function logAuditEvent(action, performedBy, details) {
    try {
        if (!supabaseClient) initSupabase();
        if (supabaseClient) {
            await supabaseClient.from('audit_logs').insert({
                action,
                entity_type: 'SYSTEM',
                entity_id: performedBy || 'anonymous',
                metadata: typeof details === 'object' ? details : { detail: String(details) }
            });
        }
    } catch (e) {
        console.warn('Audit log write notice:', e.message);
    }
}

// Export for module support
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeDatabase,
        select,
        selectOne,
        insert,
        update,
        delete: deleteRow,
        logAuditEvent
    };
}
