// CROCO HUB - BACKEND API (Node.js + Express)
// Déploie ce code sur Glitch.com, Replit.com ou Heroku

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Base de données en mémoire (utilise MongoDB ou Firebase en production)
const keys = new Map();
const usedKeys = new Map();

// ========================================
// GÉNÉRATION DE CLÉS
// ========================================

function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'CROCO-';
    
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars[Math.floor(Math.random() * chars.length)];
        }
        if (i < 2) key += '-';
    }
    
    return key;
}

// ========================================
// ENDPOINTS
// ========================================

// Page d'accueil
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>🐊 Croco Hub Key System</title>
                <style>
                    body {
                        background: #0f0f14;
                        color: #fff;
                        font-family: 'Segoe UI', sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .container {
                        text-align: center;
                        background: #1a1a20;
                        padding: 40px;
                        border-radius: 15px;
                        border: 2px solid #28c850;
                    }
                    h1 { color: #28c850; }
                    .stats {
                        margin-top: 20px;
                        font-size: 14px;
                        color: #888;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🐊 Croco Hub Key System</h1>
                    <p>API Status: <span style="color: #28c850;">✅ Online</span></p>
                    <div class="stats">
                        <p>Active Keys: ${keys.size}</p>
                        <p>Used Keys: ${usedKeys.size}</p>
                    </div>
                </div>
            </body>
        </html>
    `);
});

// Créer une nouvelle clé (admin seulement)
app.post('/create', (req, res) => {
    const { password, duration } = req.body;
    
    // Mot de passe admin (CHANGE ÇA!)
    if (password !== 'ADMIN_PASSWORD_123') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const key = generateKey();
    const durationHours = duration || 24; // 24h par défaut
    const expiration = Date.now() + (durationHours * 60 * 60 * 1000);
    
    keys.set(key, {
        key: key,
        created: Date.now(),
        expiration: expiration,
        duration: durationHours,
        used: false,
        hwid: null,
        username: null
    });
    
    res.json({
        success: true,
        key: key,
        expiration: expiration,
        duration: durationHours + 'h'
    });
});

// Créer plusieurs clés d'un coup
app.post('/create-bulk', (req, res) => {
    const { password, count, duration } = req.body;
    
    if (password !== 'ADMIN_PASSWORD_123') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const generatedKeys = [];
    const keyCount = Math.min(count || 10, 100); // Max 100 clés
    const durationHours = duration || 24;
    
    for (let i = 0; i < keyCount; i++) {
        const key = generateKey();
        const expiration = Date.now() + (durationHours * 60 * 60 * 1000);
        
        keys.set(key, {
            key: key,
            created: Date.now(),
            expiration: expiration,
            duration: durationHours,
            used: false,
            hwid: null,
            username: null
        });
        
        generatedKeys.push(key);
    }
    
    res.json({
        success: true,
        count: generatedKeys.length,
        keys: generatedKeys
    });
});

// Vérifier une clé
app.post('/verify', (req, res) => {
    const { key, hwid, username, userid } = req.body;
    
    if (!key || !hwid) {
        return res.status(400).json({
            valid: false,
            message: 'Missing key or HWID'
        });
    }
    
    const keyData = keys.get(key);
    
    if (!keyData) {
        return res.json({
            valid: false,
            message: 'Invalid key'
        });
    }
    
    // Vérifier l'expiration
    if (Date.now() > keyData.expiration) {
        keys.delete(key);
        return res.json({
            valid: false,
            message: 'Key expired'
        });
    }
    
    // Si la clé n'a jamais été utilisée, lier le HWID
    if (!keyData.used) {
        keyData.used = true;
        keyData.hwid = hwid;
        keyData.username = username;
        keyData.userid = userid;
        keyData.firstUsed = Date.now();
        keys.set(key, keyData);
    } else {
        // Vérifier que c'est le même HWID
        if (keyData.hwid !== hwid) {
            return res.json({
                valid: false,
                message: 'Key already used on another device'
            });
        }
    }
    
    const timeLeft = keyData.expiration - Date.now();
    
    res.json({
        valid: true,
        expiration: keyData.expiration,
        timeLeft: Math.floor(timeLeft / 1000),
        username: keyData.username,
        message: 'Key verified successfully'
    });
});

// Obtenir les infos d'une clé
app.get('/info/:key', (req, res) => {
    const key = req.params.key;
    const keyData = keys.get(key);
    
    if (!keyData) {
        return res.status(404).json({ error: 'Key not found' });
    }
    
    const timeLeft = Math.max(0, keyData.expiration - Date.now());
    
    res.json({
        key: key,
        used: keyData.used,
        username: keyData.username || 'Not used yet',
        created: new Date(keyData.created).toISOString(),
        expiration: new Date(keyData.expiration).toISOString(),
        timeLeft: Math.floor(timeLeft / 1000) + 's',
        expired: Date.now() > keyData.expiration
    });
});

// Lister toutes les clés (admin)
app.post('/list', (req, res) => {
    const { password } = req.body;
    
    if (password !== 'ADMIN_PASSWORD_123') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const allKeys = [];
    keys.forEach((data, key) => {
        allKeys.push({
            key: key,
            used: data.used,
            username: data.username,
            expired: Date.now() > data.expiration,
            timeLeft: Math.max(0, Math.floor((data.expiration - Date.now()) / 1000))
        });
    });
    
    res.json({
        count: allKeys.length,
        keys: allKeys
    });
});

// Supprimer une clé (admin)
app.post('/delete', (req, res) => {
    const { password, key } = req.body;
    
    if (password !== 'ADMIN_PASSWORD_123') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    if (keys.delete(key)) {
        res.json({ success: true, message: 'Key deleted' });
    } else {
        res.status(404).json({ error: 'Key not found' });
    }
});

// Nettoyer les clés expirées (automatique toutes les heures)
setInterval(() => {
    let cleaned = 0;
    keys.forEach((data, key) => {
        if (Date.now() > data.expiration) {
            keys.delete(key);
            cleaned++;
        }
    });
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired keys`);
    }
}, 60 * 60 * 1000); // Toutes les heures

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🐊 Croco Hub Key API running on port ${PORT}`);
});
