const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all devices
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [devices] = await db.query(`
            SELECT 
                id,
                device_id,
                device_name,
                location,
                status,
                mode,
                is_online,
                last_seen,
                created_at
            FROM devices
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            devices
        });

    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching devices'
        });
    }
});

// Get single device
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [devices] = await db.query(
            'SELECT * FROM devices WHERE id = ?',
            [req.params.id]
        );

        if (devices.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Device not found'
            });
        }

        res.json({
            success: true,
            device: devices[0]
        });

    } catch (error) {
        console.error('Error fetching device:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching device'
        });
    }
});

// Register new device (for IoT devices or admin)
router.post('/', async (req, res) => {
    try {
        const { device_id, device_name, location } = req.body;

        if (!device_id || !device_name) {
            return res.status(400).json({
                success: false,
                message: 'device_id and device_name are required'
            });
        }

        // Check if device already exists
        const [existing] = await db.query(
            'SELECT id FROM devices WHERE device_id = ?',
            [device_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Device already registered'
            });
        }

        // Insert new device
        const [result] = await db.query(
            'INSERT INTO devices (device_id, device_name, location) VALUES (?, ?, ?)',
            [device_id, device_name, location || '']
        );

        res.status(201).json({
            success: true,
            message: 'Device registered successfully',
            device: {
                id: result.insertId,
                device_id,
                device_name,
                location
            }
        });

    } catch (error) {
        console.error('Error registering device:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering device'
        });
    }
});

// Control device (turn ON/OFF)
router.put('/:id/control', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const deviceId = req.params.id;

        if (!status || !['ON', 'OFF'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status (ON/OFF) is required'
            });
        }

        // Update device status
        await db.query(
            'UPDATE devices SET status = ?, mode = "MANUAL" WHERE id = ?',
            [status, deviceId]
        );

        // Log the action
        await db.query(
            'INSERT INTO control_logs (device_id, action, mode, user_id, details) VALUES (?, ?, ?, ?, ?)',
            [deviceId, status, 'MANUAL', req.user.id, `Manual control: ${status}`]
        );

        res.json({
            success: true,
            message: `Device turned ${status}`,
            status
        });

    } catch (error) {
        console.error('Error controlling device:', error);
        res.status(500).json({
            success: false,
            message: 'Error controlling device'
        });
    }
});

// Change device mode (AUTO/MANUAL)
router.put('/:id/mode', authenticateToken, async (req, res) => {
    try {
        const { mode } = req.body;
        const deviceId = req.params.id;

        if (!mode || !['AUTO', 'MANUAL'].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: 'Valid mode (AUTO/MANUAL) is required'
            });
        }

        await db.query(
            'UPDATE devices SET mode = ? WHERE id = ?',
            [mode, deviceId]
        );

        // Log the action
        await db.query(
            'INSERT INTO control_logs (device_id, action, mode, user_id, details) VALUES (?, ?, ?, ?, ?)',
            [deviceId, 'MODE_CHANGE', mode, req.user.id, `Mode changed to ${mode}`]
        );

        res.json({
            success: true,
            message: `Device mode changed to ${mode}`,
            mode
        });

    } catch (error) {
        console.error('Error changing device mode:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing device mode'
        });
    }
});

// Update device online status (heartbeat from IoT device)
router.post('/:deviceId/heartbeat', async (req, res) => {
    try {
        const { device_id } = req.params;

        await db.query(
            'UPDATE devices SET is_online = true, last_seen = NOW() WHERE device_id = ?',
            [device_id]
        );

        res.json({
            success: true,
            message: 'Heartbeat received'
        });

    } catch (error) {
        console.error('Error updating heartbeat:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating heartbeat'
        });
    }
});

// Delete device
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM devices WHERE id = ?', [req.params.id]);

        res.json({
            success: true,
            message: 'Device deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting device'
        });
    }
});

module.exports = router;
