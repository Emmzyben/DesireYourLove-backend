import express from 'express';
import Database from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const db = Database.getInstance().getConnection();

// Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [notifications] = await db.execute(
      `SELECT n.id, n.type, n.message, n.is_read, n.created_at,
              u.id as from_user_id, u.first_name, u.last_name, u.profile_image
       FROM notifications n
       LEFT JOIN users u ON u.id = n.from_user_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.notificationId);

    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [userId]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await db.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    const count = result[0].count;

    res.json({ success: true, count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
});

export default router;
