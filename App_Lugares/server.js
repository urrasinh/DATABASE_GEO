const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = 'super_secret_jwt_key_geoturismo'; // Solo para desarrollo/demo

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const dbPath = path.join(__dirname, 'lugares.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database lugares.db');
    }
});

// Zonas a Regiones aproximado por coincidencia (LIKE) para evitar problemas de tildes/encoding
const ZONAS_MAP = {
    'Norte': ['%ARICA%', '%TARAPAC%', '%ANTOFAGASTA%', '%ATACAMA%', '%COQUIMBO%'],
    'Centro': ['%VALPARAISO%', '%METROPOLITANA%', '%LIBERTADOR%', '%MAULE%'],
    'Sur': ['%BIOB%', '%ARAUCANIA%', '%RIOS%', '%LAGOS%'],
    'Austral': ['%AYSEN%', '%MAGALLANES%']
};

// Endpoint: Obtener opciones únicas para filtros
app.get('/api/filtros', (req, res) => {
    const columns = ['region', 'tipo', 'subtipo', 'categoria', 'tipo_propiedad', 'demanda_turistica', 'jerarquia', 'provincia', 'comuna', 'localidad'];
    let result = {};
    let queriesCompleted = 0;

    // Hardcode zonas
    result.zonas = Object.keys(ZONAS_MAP);

    columns.forEach(col => {
        db.all(`SELECT DISTINCT ${col} as value FROM lugares WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY value`, [], (err, rows) => {
            if (err) {
                console.error(err);
                result[col] = [];
            } else {
                result[col] = rows.map(r => r.value);
            }

            queriesCompleted++;
            if (queriesCompleted === columns.length) {
                res.json(result);
            }
        });
    });
});

// Endpoint: Listar lugares con filtrado y paginación
app.get('/api/lugares', (req, res) => {
    const { zona, region, jerarquia, tipo, subtipo, categoria, tipo_propiedad, demanda_turistica, limite = 21, pagina = 1, search, sort = 'id', order = 'ASC' } = req.query;

    let whereClauses = [];
    let params = [];

    // Filtros directos
    if (region) { whereClauses.push("region = ?"); params.push(region); }
    if (jerarquia) { whereClauses.push("jerarquia = ?"); params.push(jerarquia); }
    if (tipo) { whereClauses.push("tipo = ?"); params.push(tipo); }
    if (subtipo) { whereClauses.push("subtipo = ?"); params.push(subtipo); }
    if (categoria) { whereClauses.push("categoria = ?"); params.push(categoria); }
    if (tipo_propiedad) { whereClauses.push("tipo_propiedad = ?"); params.push(tipo_propiedad); }
    if (demanda_turistica) { whereClauses.push("demanda_turistica = ?"); params.push(demanda_turistica); }

    // Filtro por Zona
    if (zona && ZONAS_MAP[zona]) {
        const likeClauses = ZONAS_MAP[zona].map(p => {
            params.push(p);
            return "region LIKE ?";
        });
        whereClauses.push(`(${likeClauses.join(' OR ')})`);
    }

    // Buscador General (Caja de Texto)
    if (search && search.trim() !== '') {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        whereClauses.push("(LOWER(nombre) LIKE ? OR LOWER(codigo) LIKE ?)");
        params.push(searchTerm, searchTerm);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Contar total
    const countQuery = `SELECT COUNT(*) as count FROM lugares ${whereString}`;

    db.get(countQuery, params, (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });

        const total = countResult.count;
        const totalPages = Math.ceil(total / limite);
        const offset = (pagina - 1) * limite;

        // Validar campos de ordenamiento para evitar inyección SQL
        const validSortFields = ['id', 'codigo', 'nombre', 'region', 'categoria', 'jerarquia'];
        const actualSort = validSortFields.includes(sort) ? sort : 'id';
        const actualOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const orderString = `ORDER BY \`${actualSort}\` ${actualOrder}`;

        // Agregar params para paginación
        params.push(limite, offset);
        const dataQuery = `SELECT * FROM lugares ${whereString} ${orderString} LIMIT ? OFFSET ?`;

        db.all(dataQuery, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                data: rows,
                pagination: {
                    total,
                    totalPages,
                    currentPage: parseInt(pagina),
                    limit: parseInt(limite)
                }
            });
        });
    });
});

// Endpoint: Obtener un lugar específico
app.get('/api/lugares/:id', (req, res) => {
    db.get("SELECT * FROM lugares WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Lugar no encontrado' });
        res.json(row);
    });
});

// Endpoint: Autocompletado rápido para buscador frontend
app.get('/api/autocomplete', (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    const searchTerm = `%${q.trim().toLowerCase()}%`;
    const query = `
        SELECT id, codigo, nombre, region 
        FROM lugares 
        WHERE LOWER(nombre) LIKE ? OR LOWER(codigo) LIKE ? 
        LIMIT 6
    `;

    db.all(query, [searchTerm, searchTerm], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Endpoint: Obtener API Key de mapas (Para que el front-end monte el script)
app.get('/api/config/maps', (req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || '' });
});

// =======================
// PANEL ADMIN - CRUD
// =======================

app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'urrasinh@gmail.com' && password === '1GmourrA1') {
        const token = jwt.sign({ user: email, role: 'superadmin' }, SECRET_KEY, { expiresIn: '8h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Crear
app.post('/api/lugares', authenticateToken, (req, res) => {
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = fields.map(() => '?').join(',');

    const query = `INSERT INTO lugares (${fields.map(f => `\`${f}\``).join(',')}) VALUES (${placeholders})`;

    db.run(query, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// Editar
app.put('/api/lugares/:id', authenticateToken, (req, res) => {
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);

    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

    const setQuery = fields.map(f => `\`${f}\` = ?`).join(', ');
    const query = `UPDATE lugares SET ${setQuery} WHERE id = ?`;

    values.push(req.params.id);

    db.run(query, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// Eliminar
app.delete('/api/lugares/:id', authenticateToken, (req, res) => {
    db.run("DELETE FROM lugares WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
