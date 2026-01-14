const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get control logs with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const deviceId = req.query.device_id;
        const action = req.query.action;
        const mode = req.query.mode;

        let query = `
            SELECT 
                l.id,
                l.device_id,
                d.device_name,
                d.device_id as device_identifier,
                l.action,
                l.mode,
                l.user_id,
                u.username,
                l.details,
                l.timestamp
            FROM control_logs l
            LEFT JOIN devices d ON l.device_id = d.id
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (deviceId) {
            query += ' AND l.device_id = ?';
            params.push(deviceId);
        }

        if (action) {
            query += ' AND l.action = ?';
            params.push(action);
        }

        if (mode) {
            query += ' AND l.mode = ?';
            params.push(mode);
        }

        query += ' ORDER BY l.timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [logs] = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM control_logs l WHERE 1=1';
        const countParams = [];

        if (deviceId) {
            countQuery += ' AND l.device_id = ?';
            countParams.push(deviceId);
        }

        if (action) {
            countQuery += ' AND l.action = ?';
            countParams.push(action);
        }

        if (mode) {
            countQuery += ' AND l.mode = ?';
            countParams.push(mode);
        }

        const [countResult] = await db.query(countQuery, countParams);

        res.json({
            success: true,
            logs,
            total: countResult[0].total,
            limit,
            offset
        });

    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching logs'
        });
    }
});

// Get logs for specific device
router.get('/device/:deviceId', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const [logs] = await db.query(`
            SELECT 
                l.id,
                l.action,
                l.mode,
                l.user_id,
                u.username,
                l.details,
                l.timestamp
            FROM control_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.device_id = ?
            ORDER BY l.timestamp DESC
            LIMIT ?
        `, [req.params.deviceId, limit]);

        res.json({
            success: true,
            logs
        });

    } catch (error) {
        console.error('Error fetching device logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching device logs'
        });
    }
});

// Get recent activity summary
router.get('/recent', authenticateToken, async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;

        const [logs] = await db.query(`
            SELECT 
                l.id,
                l.device_id,
                d.device_name,
                l.action,
                l.mode,
                u.username,
                l.details,
                l.timestamp
            FROM control_logs l
            LEFT JOIN devices d ON l.device_id = d.id
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY l.timestamp DESC
            LIMIT 20
        `, [hours]);

        res.json({
            success: true,
            logs
        });

    } catch (error) {
        console.error('Error fetching recent logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching recent logs'
        });
    }
});

module.exports = router;
