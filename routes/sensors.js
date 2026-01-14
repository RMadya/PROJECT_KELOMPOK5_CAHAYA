const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Receive sensor data from IoT devices
router.post('/data', async (req, res) => {
    try {
        const { device_id, light_intensity } = req.body;

        if (!device_id || light_intensity === undefined) {
            return res.status(400).json({
                success: false,
                message: 'device_id and light_intensity are required'
            });
        }

        // Get device internal ID
        const [devices] = await db.query(
            'SELECT id, mode FROM devices WHERE device_id = ?',
            [device_id]
        );

        if (devices.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found. Please register device first.'
            });
        }

        const device = devices[0];

        // Insert sensor data
        await db.query(
            'INSERT INTO sensor_data (device_id, light_intensity) VALUES (?, ?)',
            [device.id, light_intensity]
        );

        // Update device last seen
        await db.query(
            'UPDATE devices SET is_online = true, last_seen = NOW() WHERE id = ?',
            [device.id]
        );

        // Auto mode logic
        let autoAction = null;
        if (device.mode === 'AUTO') {
            // Get light threshold from settings
            const [settings] = await db.query(
                'SELECT setting_value FROM system_settings WHERE setting_key = "light_threshold"'
            );

            const threshold = settings.length > 0 ? parseInt(settings[0].setting_value) : 300;

            // Determine if lamp should be ON or OFF
            // LDR: Higher value = darker, Lower value = brighter
            const shouldBeOn = light_intensity > threshold;
            const newStatus = shouldBeOn ? 'ON' : 'OFF';

            // Get current status
            const [currentDevice] = await db.query(
                'SELECT status FROM devices WHERE id = ?',
                [device.id]
            );

            // Only update if status needs to change
            if (currentDevice[0].status !== newStatus) {
                await db.query(
                    'UPDATE devices SET status = ? WHERE id = ?',
                    [newStatus, device.id]
                );

                // Log auto action
                await db.query(
                    'INSERT INTO control_logs (device_id, action, mode, details) VALUES (?, ?, ?, ?)',
                    [device.id, newStatus, 'AUTO', `Auto control: Light intensity ${light_intensity} < ${threshold}`]
                );

                autoAction = newStatus;
            }
        }

        res.json({
            success: true,
            message: 'Sensor data received',
            auto_action: autoAction,
            current_status: autoAction || device.status
        });

    } catch (error) {
        console.error('Error processing sensor data:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing sensor data'
        });
    }
});

// Get sensor data for a specific device
router.get('/data/:deviceId', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const [data] = await db.query(`
            SELECT 
                id,
                light_intensity,
                timestamp
            FROM sensor_data
            WHERE device_id = ?
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        `, [req.params.deviceId, limit, offset]);

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Error fetching sensor data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching sensor data'
        });
    }
});

// Get latest sensor readings from all devices
router.get('/latest', async (req, res) => {
    try {
        const [data] = await db.query(`
            SELECT 
                d.id,
                d.device_id,
                d.device_name,
                d.location,
                d.status,
                d.mode,
                s.light_intensity,
                s.timestamp
            FROM devices d
            LEFT JOIN (
                SELECT device_id, light_intensity, timestamp
                FROM sensor_data s1
                WHERE timestamp = (
                    SELECT MAX(timestamp)
                    FROM sensor_data s2
                    WHERE s2.device_id = s1.device_id
                )
            ) s ON d.id = s.device_id
            ORDER BY d.id
        `);

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Error fetching latest sensor data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching latest sensor data'
        });
    }
});

// Get sensor statistics for dashboard
router.get('/stats', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;

        const [stats] = await db.query(`
            SELECT 
                d.id,
                d.device_id,
                d.device_name,
                AVG(s.light_intensity) as avg_intensity,
                MIN(s.light_intensity) as min_intensity,
                MAX(s.light_intensity) as max_intensity,
                COUNT(s.id) as reading_count
            FROM devices d
            LEFT JOIN sensor_data s ON d.id = s.device_id
            WHERE s.timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            GROUP BY d.id, d.device_id, d.device_name
        `, [hours]);

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Error fetching sensor stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching sensor stats'
        });
    }
});

module.exports = router;
