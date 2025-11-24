const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load environment variables if .env file exists
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config();
}

const CONFIG_PATH = path.join(__dirname, 'config.json');

let db;

function readConfig() {
    try {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('❌ FATAL: Could not read config.json:', error.message);
        throw new Error(`Failed to read config.json. Make sure it exists. Error: ${error.message}`);
    }
}

function writeConfig(newConfig) {
    try {
        const configString = JSON.stringify(newConfig, null, 2);
        fs.writeFileSync(CONFIG_PATH, configString, 'utf8');
        console.log('✅ Config.json updated successfully.');
    } catch (error) {
        console.error('❌ FATAL: Could not write to config.json:', error.message);
        throw new Error(`Failed to write config.json. Error: ${error.message}`);
    }
}

async function connectDatabase() {
    let dbConfig;
    try {
        // Use environment variables if available, otherwise use config.json
        if (process.env.DB_HOST) {
            dbConfig = {
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT) || 3306,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: process.env.DB_SSL === 'true'
            };
            console.log('🌐 Using cloud database configuration from environment variables');
        } else {
            const config = readConfig();
            dbConfig = config.database;
            console.log('💻 Using local database configuration from config.json');
        }

        const dbPort = dbConfig.port || 3306;

        // Only create database if localhost
        if (dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1') {
            const tempConnection = await mysql.createConnection({
                host: dbConfig.host,
                port: dbPort,
                user: dbConfig.user,
                password: dbConfig.password
            });
            await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
            await tempConnection.end();
        }

        // Create pool with SSL
        const poolConfig = {
            host: dbConfig.host,
            port: dbPort,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            timezone: '+05:30',
            dateStrings: true
        };

        // SSL enable for cloud
        if (dbConfig.ssl || dbConfig.host.includes('aivencloud.com')) {
            poolConfig.ssl = {
                rejectUnauthorized: false
            };
            console.log('🔒 SSL enabled for secure connection');
        }

        db = await mysql.createPool(poolConfig);

        await db.query('SELECT 1');
        console.log(`✅ DB Connected to ${dbConfig.host}:${dbPort}`);
        return;

    } catch (err) {
        console.error('❌ DB Connect Error:', err.message);
        throw err;
    }
}

function toIndiaDatetimeSQL(value) {
    if (!value) return null;
    let d = (value instanceof Date) ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    const ms = d.getTime() + (5.5 * 60 * 60 * 1000);
    const id = new Date(ms);
    const pad = n => String(n).padStart(2, '0');
    const YYYY = id.getUTCFullYear();
    const MM = pad(id.getUTCMonth() + 1);
    const DD = pad(id.getUTCDate());
    const hh = pad(id.getUTCHours());
    const mm = pad(id.getUTCMinutes());
    const ss = pad(id.getUTCSeconds());
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

async function initialize() {
    try {
        await connectDatabase();
        console.log('🔄 Initializing tables...');

        const tables = [
            `CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTO_INCREMENT, customer_name TEXT NOT NULL, phone_no TEXT, area TEXT, address TEXT, email TEXT, company_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS service_calls (id INTEGER PRIMARY KEY AUTO_INCREMENT, customer_id INTEGER, area VARCHAR(255), issue_description TEXT, status VARCHAR(50) DEFAULT 'Open', priority VARCHAR(50) DEFAULT 'Medium', technician_name VARCHAR(100), scheduled_date DATETIME, resolution_details TEXT, service_charge DECIMAL(10, 2) DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL)`,
            `CREATE TABLE IF NOT EXISTS repair_records (id INTEGER PRIMARY KEY AUTO_INCREMENT, customer_id INTEGER NOT NULL, machine_description TEXT, repair_description TEXT, repair_date DATE, amount_charged DECIMAL(10, 2) DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE)`,
            `CREATE TABLE IF NOT EXISTS amc_records (id INTEGER PRIMARY KEY AUTO_INCREMENT, customer_id INTEGER NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, amount DECIMAL(10, 2) DEFAULT 0, machine_details TEXT, status VARCHAR(50) DEFAULT 'Active', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE)`,
            `CREATE TABLE IF NOT EXISTS settings (key_name VARCHAR(100) PRIMARY KEY NOT NULL, value_data TEXT)`,
            `CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL UNIQUE)`,
            `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTO_INCREMENT, username VARCHAR(100) NOT NULL UNIQUE, password VARCHAR(100) NOT NULL, role VARCHAR(50) DEFAULT 'admin')`,
            `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255), price DECIMAL(10,2) DEFAULT 0)`,
            `CREATE TABLE IF NOT EXISTS common_issues (id INTEGER PRIMARY KEY AUTO_INCREMENT, issue_text VARCHAR(255) NOT NULL UNIQUE)`,
            `CREATE TABLE IF NOT EXISTS common_resolutions (id INTEGER PRIMARY KEY AUTO_INCREMENT, resolution_text VARCHAR(255) NOT NULL UNIQUE)`
        ];

        for (const sql of tables) { await db.query(sql); }

        await Promise.all([autoUpdateAmcStatuses(), insertDefaultUser()]);
        console.log('✅ All tables initialized');

    } catch (err) {
        console.error('❌ DB Initialization Failed:', err);
        throw err;
    }
}

async function insertDefaultUser() {
    try {
        const [rows] = await db.query("SELECT COUNT(*) as count FROM users");
        if (rows[0].count === 0) {
            await db.query(`INSERT INTO users (username, password) VALUES (?, ?)`, ['admin', 'admin']);
            console.log('✅ Default user "admin" created.');
        }
    } catch (err) { console.error('User init error:', err); }
}

async function autoUpdateAmcStatuses() {
    try {
        const today = new Date().toISOString().split('T')[0];
        await db.query(`UPDATE amc_records SET status = 'Expired' WHERE end_date < ? AND status = 'Active'`, [today]);
    } catch (err) { console.error('AMC auto-update error:', err); }
}

// --- CRUD Functions ---

async function getAllCustomers() { const [rows] = await db.query(`SELECT * FROM customers ORDER BY id ASC`); return rows; }
async function addCustomer(c) {
    const sql = `INSERT INTO customers(customer_name,phone_no,area,address,email,company_name) VALUES(?,?,?,?,?,?)`;
    const [result] = await db.query(sql, [c.name, c.phone, c.area, c.address, c.email, c.company]);
    return { id: result.insertId, message: 'Customer added' };
}
async function updateCustomer(c) {
    const sql = `UPDATE customers SET customer_name=?, phone_no=?, area=?, address=?, email=?, company_name=? WHERE id=?`;
    const [result] = await db.query(sql, [c.name, c.phone, c.area, c.address, c.email, c.company, c.id]);
    return { changes: result.affectedRows };
}
async function deleteCustomer(id) {
    const [result] = await db.query(`DELETE FROM customers WHERE id=?`, [id]);
    return { changes: result.affectedRows };
}

// Service Calls
async function addServiceCall(sc) {
    const d = sc.scheduledDate || null;
    const p = [sc.customerId, sc.area, sc.issue_description, sc.status || 'Open', sc.priority || 'Medium', sc.technician_name || '', d, sc.resolution_details || '', sc.service_charge || 0];
    const [result] = await db.query(`INSERT INTO service_calls(customer_id, area, issue_description, status, priority, technician_name, scheduled_date, resolution_details, service_charge) VALUES(?,?,?,?,?,?,?,?,?)`, p);
    return { id: result.insertId };
}
async function getAllServiceCalls() { const [rows] = await db.query(`SELECT sc.*, c.customer_name, c.phone_no FROM service_calls sc LEFT JOIN customers c ON sc.customer_id=c.id ORDER BY sc.created_at DESC`); return rows; }
async function getServiceCallById(id) { const [rows] = await db.query(`SELECT sc.*, c.customer_name, c.phone_no, c.address, c.email FROM service_calls sc LEFT JOIN customers c ON sc.customer_id=c.id WHERE sc.id=?`, [id]); return rows[0]; }
async function updateServiceCall(sc) {
    const d = sc.scheduledDate || null;
    const p = [sc.customerId, sc.area, sc.issue_description, sc.status, sc.priority, sc.technician_name, d, sc.resolution_details, sc.service_charge, sc.id];
    const [result] = await db.query(`UPDATE service_calls SET customer_id=?, area=?, issue_description=?, status=?, priority=?, technician_name=?, scheduled_date=?, resolution_details=?, service_charge=? WHERE id=?`, p);
    return { changes: result.affectedRows };
}
async function updateServiceCallStatus(id, st, res) { const [r] = await db.query(`UPDATE service_calls SET status=?, resolution_details=? WHERE id=?`, [st, res, id]); return { changes: r.affectedRows }; }
async function deleteServiceCall(id) { const [r] = await db.query(`DELETE FROM service_calls WHERE id=?`, [id]); return { changes: r.affectedRows }; }

// Repairs
async function getAllRepairRecords(f = {}) {
    let sql = `SELECT rr.*, c.customer_name, c.phone_no FROM repair_records rr LEFT JOIN customers c ON rr.customer_id=c.id`;
    const p = []; const c = [];
    if (f.startDate) { c.push("rr.repair_date >= ?"); p.push(f.startDate); }
    if (f.endDate) { c.push("rr.repair_date <= ?"); p.push(f.endDate); }
    if (c.length) sql += " WHERE " + c.join(" AND ");
    sql += " ORDER BY rr.repair_date DESC";
    const [rows] = await db.query(sql, p);
    return rows.map(r => ({ ...r, machine: r.machine_description, details: r.repair_description, amount: r.amount_charged, date: r.repair_date }));
}
async function addRepairRecord(r) {
    const p = [r.customerId, r.machine_description, r.repair_description, r.repair_date, r.amount_charged];
    const [res] = await db.query(`INSERT INTO repair_records(customer_id,machine_description,repair_description,repair_date,amount_charged) VALUES(?,?,?,?,?)`, p);
    return { id: res.insertId };
}
async function updateRepairRecord(r) {
    const p = [r.customerId, r.machine_description, r.repair_description, r.repair_date, r.amount_charged, r.id];
    const [res] = await db.query(`UPDATE repair_records SET customer_id=?,machine_description=?,repair_description=?,repair_date=?,amount_charged=? WHERE id=?`, p);
    return { changes: res.affectedRows };
}
async function deleteRepairRecord(id) { const [r] = await db.query(`DELETE FROM repair_records WHERE id=?`, [id]); return { changes: r.affectedRows }; }

// AMC
async function getAllAmcRecords(f = {}) {
    let sql = `SELECT amc.*, c.customer_name, c.phone_no FROM amc_records amc LEFT JOIN customers c ON amc.customer_id=c.id`;
    const p = []; const c = [];
    if (f.status) { c.push("amc.status=?"); p.push(f.status); }
    if (f.expiringSoon) {
        const t = new Date().toISOString().split('T')[0];
        const f30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        c.push("amc.status='Active'"); c.push("amc.end_date >= ?"); p.push(t); c.push("amc.end_date <= ?"); p.push(f30);
    }
    if (c.length) sql += " WHERE " + c.join(" AND ");
    sql += " ORDER BY amc.end_date ASC";
    const [rows] = await db.query(sql, p);
    return rows;
}
async function addAmcRecord(r) {
    const p = [r.customerId, r.start_date, r.end_date, r.amount, r.machine_details, r.status, r.notes];
    const [res] = await db.query(`INSERT INTO amc_records(customer_id,start_date,end_date,amount,machine_details,status,notes) VALUES(?,?,?,?,?,?,?)`, p);
    return { id: res.insertId };
}
async function updateAmcRecord(r) {
    const p = [r.customerId, r.start_date, r.end_date, r.amount, r.machine_details, r.status, r.notes, r.id];
    const [res] = await db.query(`UPDATE amc_records SET customer_id=?,start_date=?,end_date=?,amount=?,machine_details=?,status=?,notes=? WHERE id=?`, p);
    return { changes: res.affectedRows };
}
async function deleteAmcRecord(id) { const [r] = await db.query(`DELETE FROM amc_records WHERE id=?`, [id]); return { changes: r.affectedRows }; }
async function getAmcsExpiringSoon(days = 30) { return getAllAmcRecords({ expiringSoon: true }); }

// Stats
async function getPendingCallsForToday() {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await db.query(`SELECT sc.*, c.customer_name, c.phone_no FROM service_calls sc LEFT JOIN customers c ON sc.customer_id = c.id WHERE sc.status NOT IN ('Completed', 'Closed') AND DATE(sc.scheduled_date) = ? ORDER BY sc.scheduled_date ASC`, [today]);
    return rows;
}
async function getDashboardStats() {
    const [c] = await db.query("SELECT COUNT(*) as c FROM customers");
    const [sc] = await db.query("SELECT COUNT(*) as c FROM service_calls");
    const [rr] = await db.query("SELECT COUNT(*) as c FROM repair_records");
    const [amc] = await db.query("SELECT COUNT(*) as c FROM amc_records WHERE status='Active'");
    const [amcx] = await db.query(`SELECT COUNT(*) as c FROM amc_records WHERE status='Active' AND end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)`);
    return { totalCustomers: c[0].c, totalServiceCalls: sc[0].c, totalRepairs: rr[0].c, activeAMCs: amc[0].c, expiringAmcsCount: amcx[0].c };
}
async function getMonthlyStats() {
    const sql = `SELECT DATE_FORMAT(m.month, '%Y-%m') as month, COALESCE(c.cnt,0) as serviceCalls, COALESCE(r.cnt,0) as repairRecords FROM (SELECT CURDATE() - INTERVAL 0 MONTH as month UNION SELECT CURDATE() - INTERVAL 1 MONTH UNION SELECT CURDATE() - INTERVAL 2 MONTH UNION SELECT CURDATE() - INTERVAL 3 MONTH UNION SELECT CURDATE() - INTERVAL 4 MONTH UNION SELECT CURDATE() - INTERVAL 5 MONTH) m LEFT JOIN (SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as cnt FROM service_calls GROUP BY 1) c ON DATE_FORMAT(m.month, '%Y-%m') = c.month LEFT JOIN (SELECT DATE_FORMAT(repair_date, '%Y-%m') as month, COUNT(*) as cnt FROM repair_records GROUP BY 1) r ON DATE_FORMAT(m.month, '%Y-%m') = r.month ORDER BY m.month ASC`;
    const [rows] = await db.query(sql);
    return rows;
}

// Misc
async function getAllSettings() { const [rows] = await db.query(`SELECT * FROM settings`); const obj = {}; rows.forEach(r => { obj[r.key_name] = r.value_data }); return obj; }
async function saveSetting(k, v) { const [r] = await db.query(`INSERT INTO settings (key_name, value_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_data = ?`, [k, v, v]); return { changes: r.affectedRows }; }
async function getAreas() { const [rows] = await db.query(`SELECT * FROM areas ORDER BY name ASC`); return rows; }
async function addArea(name) { const [r] = await db.query(`INSERT INTO areas (name) VALUES (?)`, [name]); return { id: r.insertId, name }; }
async function deleteArea(id) { const [r] = await db.query(`DELETE FROM areas WHERE id=?`, [id]); return { changes: r.affectedRows }; }
async function getUser(u, p) { const [rows] = await db.query(`SELECT * FROM users WHERE username=? AND password=?`, [u, p]); return rows[0]; }
async function changePassword(u, oldP, newP) { const user = await getUser(u, oldP); if (user) { await db.query(`UPDATE users SET password=? WHERE username=?`, [newP, u]); return { message: 'Password updated' }; } throw new Error('Incorrect old password'); }
async function getProducts() { const [rows] = await db.query(`SELECT id, name, price FROM products ORDER BY name ASC`); return rows; }
async function addProduct(p) { const [r] = await db.query(`INSERT INTO products (name, price) VALUES (?,?)`, [p.name, p.price]); return { id: r.insertId, ...p }; }
async function deleteProduct(id) { const [r] = await db.query(`DELETE FROM products WHERE id=?`, [id]); return { changes: r.affectedRows }; }
async function getCommonIssues() { const [rows] = await db.query(`SELECT * FROM common_issues`); return rows; }
async function addCommonIssue(t) { const [r] = await db.query(`INSERT INTO common_issues(issue_text) VALUES(?)`, [t]); return { id: r.insertId, issue_text: t }; }
async function deleteCommonIssue(id) { const [r] = await db.query(`DELETE FROM common_issues WHERE id=?`, [id]); return { changes: r.affectedRows }; }
async function getCommonResolutions() { const [rows] = await db.query(`SELECT * FROM common_resolutions`); return rows; }
async function addCommonResolution(t) { const [r] = await db.query(`INSERT INTO common_resolutions(resolution_text) VALUES(?)`, [t]); return { id: r.insertId, resolution_text: t }; }
async function deleteCommonResolution(id) { const [r] = await db.query(`DELETE FROM common_resolutions WHERE id=?`, [id]); return { changes: r.affectedRows }; }

module.exports = { db, initialize, readConfig, writeConfig, getAllCustomers, addCustomer, updateCustomer, deleteCustomer, addServiceCall, getAllServiceCalls, getServiceCallById, updateServiceCall, updateServiceCallStatus, deleteServiceCall, getAllRepairRecords, addRepairRecord, updateRepairRecord, deleteRepairRecord, getAllAmcRecords, addAmcRecord, updateAmcRecord, deleteAmcRecord, getAmcsExpiringSoon, getPendingCallsForToday, getDashboardStats, getMonthlyStats, getAllSettings, saveSetting, getAreas, addArea, deleteArea, getUser, changePassword, getProducts, addProduct, deleteProduct, getCommonIssues, addCommonIssue, deleteCommonIssue, getCommonResolutions, addCommonResolution, deleteCommonResolution };