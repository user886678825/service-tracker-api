const express = require('express');
const cors = require('cors');
const database = require('./database'); // તમારી database.js ફાઈલ અહીં ઈમ્પોર્ટ થશે

const app = express();

// મિડલવેર (Middleware)
app.use(cors()); // મોબાઈલ એપને કનેક્ટ થવા દેવા માટે
app.use(express.json()); // JSON ડેટા વાંચવા માટે

// સર્વર ચાલુ થાય ત્યારે ડેટાબેઝ કનેક્ટ કરો
database.initialize()
    .then(() => console.log('✅ Database connected successfully via API'))
    .catch(err => console.error('❌ Database Connection Error:', err));

// ==========================================
// 🔐 1. લોગિન અને યુઝર (Authentication)
// ==========================================

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await database.getUser(username, password); //
        if (user) {
            res.json({ success: true, user: { username: user.username, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: 'ખોટો યુઝરનેમ અથવા પાસવર્ડ' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/change-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        const result = await database.changePassword(username, oldPassword, newPassword); //
        res.json({ success: true, message: result.message });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==========================================
// 📊 2. ડેશબોર્ડ અને આંકડા (Dashboard Stats)
// ==========================================

app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const stats = await database.getDashboardStats(); //
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/monthly-stats', async (req, res) => {
    try {
        const stats = await database.getMonthlyStats(); //
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 👥 3. ગ્રાહકો (Customers)
// ==========================================

app.get('/api/customers', async (req, res) => {
    try {
        const customers = await database.getAllCustomers(); //
        res.json(customers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/customers', async (req, res) => {
    try {
        const result = await database.addCustomer(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/customers', async (req, res) => {
    try {
        const result = await database.updateCustomer(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try {
        const result = await database.deleteCustomer(req.params.id); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 📞 4. સર્વિસ કોલ્સ (Service Calls)
// ==========================================

app.get('/api/service-calls', async (req, res) => {
    try {
        const calls = await database.getAllServiceCalls(); //
        res.json(calls);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// પેન્ડિંગ કોલ્સ (આજના)
app.get('/api/service-calls/pending', async (req, res) => {
    try {
        const calls = await database.getPendingCallsForToday(); //
        res.json(calls);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/service-calls', async (req, res) => {
    try {
        const result = await database.addServiceCall(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/service-calls', async (req, res) => {
    try {
        const result = await database.updateServiceCall(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// સ્ટેટસ અપડેટ કરવા માટે (ઉ.દા. Open -> Completed)
app.put('/api/service-calls/status', async (req, res) => {
    try {
        const { id, status, resolution } = req.body;
        const result = await database.updateServiceCallStatus(id, status, resolution); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/service-calls/:id', async (req, res) => {
    try {
        const result = await database.deleteServiceCall(req.params.id); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 🛠️ 5. રિપેરિંગ રેકોર્ડ્સ (Repair Records)
// ==========================================

app.get('/api/repairs', async (req, res) => {
    try {
        // ફિલ્ટર માટે URL parameters (દા.ત. ?startDate=2023-01-01)
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const repairs = await database.getAllRepairRecords(filters); //
        res.json(repairs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/repairs', async (req, res) => {
    try {
        const result = await database.addRepairRecord(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/repairs', async (req, res) => {
    try {
        const result = await database.updateRepairRecord(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/repairs/:id', async (req, res) => {
    try {
        const result = await database.deleteRepairRecord(req.params.id); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 📝 6. AMC રેકોર્ડ્સ (AMC Records)
// ==========================================

app.get('/api/amc', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            expiringSoon: req.query.expiringSoon === 'true' // એક્સપાયર થતા AMC જોવા માટે
        };
        const amcs = await database.getAllAmcRecords(filters); //
        res.json(amcs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/amc', async (req, res) => {
    try {
        const result = await database.addAmcRecord(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/amc', async (req, res) => {
    try {
        const result = await database.updateAmcRecord(req.body); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/amc/:id', async (req, res) => {
    try {
        const result = await database.deleteAmcRecord(req.params.id); //
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// ⚙️ 7. માસ્ટર સેટિંગ્સ (Areas, Products, Settings)
// ==========================================

// Areas
app.get('/api/areas', async (req, res) => {
    try { res.json(await database.getAreas()); } catch (e) { res.status(500).json({ error: e.message }); } //
});
app.post('/api/areas', async (req, res) => {
    try { res.json(await database.addArea(req.body.name)); } catch (e) { res.status(500).json({ error: e.message }); } //
});
app.delete('/api/areas/:id', async (req, res) => {
    try { res.json(await database.deleteArea(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); } //
});

// Products
app.get('/api/products', async (req, res) => {
    try { res.json(await database.getProducts()); } catch (e) { res.status(500).json({ error: e.message }); } //
});
app.post('/api/products', async (req, res) => {
    try { res.json(await database.addProduct(req.body)); } catch (e) { res.status(500).json({ error: e.message }); } //
});
app.delete('/api/products/:id', async (req, res) => {
    try { res.json(await database.deleteProduct(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); } //
});

// Common Issues & Resolutions
app.get('/api/common-issues', async (req, res) => {
    try { res.json(await database.getCommonIssues()); } catch (e) { res.status(500).json({ error: e.message }); } //
});
app.post('/api/common-issues', async (req, res) => {
    try { res.json(await database.addCommonIssue(req.body.text)); } catch (e) { res.status(500).json({ error: e.message }); } //
}); // Note: Android app should send { "text": "Issue Name" }
app.delete('/api/common-issues/:id', async (req, res) => {
    try { res.json(await database.deleteCommonIssue(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); } //
});

app.get('/api/common-resolutions', async (req, res) => {
    try { res.json(await database.getCommonResolutions()); } catch (e) { res.status(500).json({ error: e.message }); } //
});
app.post('/api/common-resolutions', async (req, res) => {
    try { res.json(await database.addCommonResolution(req.body.text)); } catch (e) { res.status(500).json({ error: e.message }); } //
});
app.delete('/api/common-resolutions/:id', async (req, res) => {
    try { res.json(await database.deleteCommonResolution(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); } //
});

// General App Settings (Company Info)
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await database.getAllSettings(); //
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// સેટિંગ્સ સેવ કરવા માટે (Array સ્વીકારે છે)
app.post('/api/settings', async (req, res) => {
    try {
        const settingsArray = req.body; // Expecting Array: [{key: 'companyName', value: '...'}]
        if (Array.isArray(settingsArray)) {
            for (const setting of settingsArray) {
                await database.saveSetting(setting.key, setting.value); //
            }
            res.json({ success: true, message: 'Settings saved' });
        } else {
            res.status(400).json({ error: 'Data should be an array of settings' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// 🚀 સર્વર સ્ટાર્ટ કરો
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 Service Tracker API Running on Port: ${PORT}`);
    console.log(`   Use this URL in your Android App`);
    console.log(`=============================================`);
});