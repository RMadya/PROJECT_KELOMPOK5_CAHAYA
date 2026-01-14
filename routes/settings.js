const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all system settings
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [settings] = await db.query('SELECT * FROM system_settings');

        // Convert to key-value object
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.setting_key] = setting.setting_value;
        });

        res.json({
            success: true,
            settings: settingsObj
        });

    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching settings'
        });
    }
});

// Update system settings
router.put('/', authenticateToken, async (req, res) => {
    try {
        const { auto_mode_enabled, light_threshold, polling_interval } = req.body;

        if (auto_mode_enabled !== undefined) {
            await db.query(
                'UPDATE system_settings SET setting_value = ? WHERE setting_key = "auto_mode_enabled"',
                [auto_mode_enabled.toString()]
            );
        }

        if (light_threshold !== undefined) {
            await db.query(
                'UPDATE system_settings SET setting_value = ? WHERE setting_key = "light_threshold"',
                [light_threshold.toString()]
            );
        }

        if (polling_interval !== undefined) {
            await db.query(
                'UPDATE system_settings SET setting_value = ? WHERE setting_key = "polling_interval"',
                [polling_interval.toString()]
            );
        }

        res.json({
            success: true,
            message: 'Settings updated successfully'
        });

    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating settings'
        });
    }
});

// Get dashboard statistics
router.get('/dashboard-stats', authenticateToken, async (req, res) => {
    try {
        // Total devices
        const [totalDevices] = await db.query(
            'SELECT COUNT(*) as count FROM devices'
        );

        // Active lamps (ON)
        const [activeLamps] = await db.query(
            'SELECT COUNT(*) as count FROM devices WHERE status = "ON"'
        );

        // Online devices
        const [onlineDevices] = await db.query(
            'SELECT COUNT(*) as count FROM devices WHERE is_online = true'
        );

        // Auto mode devices
        const [autoModeDevices] = await db.query(
            'SELECT COUNT(*) as count FROM devices WHERE mode = "AUTO"'
        );

        // Recent sensor readings (last hour)
        const [recentReadings] = await db.query(
            'SELECT COUNT(*) as count FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)'
        );

        // Calculate energy saved (simplified calculation)
        // Assuming each lamp is 50W, and we calculate hours saved when OFF during night
        const [energyData] = await db.query(`
            SELECT 
                COUNT(*) as off_count
            FROM control_logs
            WHERE action = 'OFF' 
            AND mode = 'AUTO'
            AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        const energySaved = (energyData[0].off_count * 0.05).toFixed(2); // kWh

        res.json({
            success: true,
            stats: {
                total_devices: totalDevices[0].count,
                active_lamps: activeLamps[0].count,
                online_devices: onlineDevices[0].count,
                auto_mode_devices: autoModeDevices[0].count,
                recent_readings: recentReadings[0].count,
                energy_saved: energySaved
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats'
        });
    }
});

module.exports = router;
