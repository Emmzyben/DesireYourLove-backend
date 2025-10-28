import express from 'express';
import Database from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const db = Database.getInstance().getConnection();

// Add user to favorites
router.post('/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = parseInt(req.params.userId);

    if (userId === favoriteUserId) {
      return res.status(400).json({ success: false, message: 'Cannot add yourself to favorites' });
    }

    // Check if already in favorites
    const [existing] = await db.execute(
      'SELECT id FROM favorites WHERE user_id = ? AND favorite_user_id = ?',
      [userId, favoriteUserId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'User already in favorites' });
    }

    // Add to favorites
    await db.execute(
      'INSERT INTO favorites (user_id, favorite_user_id) VALUES (?, ?)',
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Added to favorites' });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ success: false, message: 'Failed to add to favorites' });
  }
});

// Remove user from favorites
router.delete('/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = parseInt(req.params.userId);

    await db.execute(
      'DELETE FROM favorites WHERE user_id = ? AND favorite_user_id = ?',
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove from favorites' });
  }
});

// Get user's favorites
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [favorites] = await db.execute(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.age, u.bio, u.country, u.state, u.city, u.photos,
              f.created_at as favorited_date,
              CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END as matched
       FROM favorites f
       JOIN users u ON u.id = f.favorite_user_id
       LEFT JOIN matches m ON (m.user1_id = LEAST(f.user_id, f.favorite_user_id) AND m.user2_id = GREATEST(f.user_id, f.favorite_user_id))
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );

    // Parse photos JSON for each favorite
    const processedFavorites = favorites.map(favorite => ({
      ...favorite,
      photos: favorite.photos ? JSON.parse(favorite.photos) : [],
      matched: Boolean(favorite.matched)
    }));

    res.json({ success: true, favorites: processedFavorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, message: 'Failed to get favorites' });
  }
});

export default router;
