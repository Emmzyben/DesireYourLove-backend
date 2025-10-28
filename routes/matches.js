import express from 'express';
import Database from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const db = Database.getInstance().getConnection();

// Like a user
router.post('/like/:userId', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.id;
    const likedId = parseInt(req.params.userId);

    if (likerId === likedId) {
      return res.status(400).json({ success: false, message: 'Cannot like yourself' });
    }

    // Check if already liked
    const [existingLike] = await db.execute(
      'SELECT id FROM likes WHERE liker_id = ? AND liked_id = ?',
      [likerId, likedId]
    );

    if (existingLike.length > 0) {
      return res.status(400).json({ success: false, message: 'Already liked this user' });
    }

    // Add like
    await db.execute(
      'INSERT INTO likes (liker_id, liked_id) VALUES (?, ?)',
      [likerId, likedId]
    );

    let isMatch = false;
    let matchedUser = null;

    // Check if it's a mutual like (match)
    const [mutualLike] = await db.execute(
      'SELECT id FROM likes WHERE liker_id = ? AND liked_id = ?',
      [likedId, likerId]
    );

    if (mutualLike.length > 0) {
      // It's a match! Create match record
      await db.execute(
        'INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)',
        [Math.min(likerId, likedId), Math.max(likerId, likedId)]
      );

      // Get matched user info
      const [user] = await db.execute(
        'SELECT id, first_name, profile_image FROM users WHERE id = ?',
        [likedId]
      );
      matchedUser = user[0];
      isMatch = true;

      // Create notifications for both users
      await db.execute(
        'INSERT INTO notifications (user_id, type, from_user_id, message) VALUES (?, ?, ?, ?)',
        [likedId, 'match', likerId, 'You have a new match!']
      );
      await db.execute(
        'INSERT INTO notifications (user_id, type, from_user_id, message) VALUES (?, ?, ?, ?)',
        [likerId, 'match', likedId, 'You have a new match!']
      );
    } else {
      // Get liker's first name
      const [liker] = await db.execute(
        'SELECT first_name FROM users WHERE id = ?',
        [likerId]
      );
      const likerFirstName = liker[0]?.first_name || 'Someone';

      // Create like notification
      await db.execute(
        'INSERT INTO notifications (user_id, type, from_user_id, message) VALUES (?, ?, ?, ?)',
        [likedId, 'like', likerId, `${likerFirstName} liked your profile!`]
      );
    }

    res.json({
      success: true,
      isMatch,
      matchedUser
    });
  } catch (error) {
    console.error('Like user error:', error);
    res.status(500).json({ success: false, message: 'Failed to like user' });
  }
});

// Dislike a user
router.post('/dislike/:userId', authenticateToken, async (req, res) => {
  try {
    const dislikerId = req.user.id;
    const dislikedId = parseInt(req.params.userId);

    if (dislikerId === dislikedId) {
      return res.status(400).json({ success: false, message: 'Cannot dislike yourself' });
    }

    // For now, dislike doesn't store anything, just returns success
    // In future, could add a dislikes table to prevent showing again
    res.json({ success: true });
  } catch (error) {
    console.error('Dislike user error:', error);
    res.status(500).json({ success: false, message: 'Failed to dislike user' });
  }
});

// Unmatch a user
router.post('/unmatch/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherId = parseInt(req.params.userId);

    if (userId === otherId) {
      return res.status(400).json({ success: false, message: 'Cannot unmatch yourself' });
    }

    // Find the match
    const [match] = await db.execute(
      'SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?',
      [Math.min(userId, otherId), Math.max(userId, otherId)]
    );

    if (match.length === 0) {
      return res.status(400).json({ success: false, message: 'No match found' });
    }

    // Delete the match
    await db.execute(
      'DELETE FROM matches WHERE id = ?',
      [match[0].id]
    );

    // Get user's first name
    const [user] = await db.execute(
      'SELECT first_name FROM users WHERE id = ?',
      [userId]
    );
    const firstName = user[0]?.first_name || 'Someone';

    // Send notification to the other user
    await db.execute(
      'INSERT INTO notifications (user_id, type, from_user_id, message) VALUES (?, ?, ?, ?)',
      [otherId, 'unmatch', userId, `${firstName} unmatched with you`]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unmatch user error:', error);
    res.status(500).json({ success: false, message: 'Failed to unmatch user' });
  }
});

// Get user's matches
router.get('/my-matches', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [matches] = await db.execute(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.age, u.bio, u.country, u.state, u.city, u.photos,
              m.created_at as match_date
       FROM matches m
       JOIN users u ON (u.id = m.user1_id OR u.id = m.user2_id)
       WHERE (m.user1_id = ? OR m.user2_id = ?) AND u.id != ?
       ORDER BY m.created_at DESC`,
      [userId, userId, userId]
    );

    // Parse photos JSON for each match
    const processedMatches = matches.map(match => ({
      ...match,
      photos: match.photos ? JSON.parse(match.photos) : []
    }));

    res.json({ success: true, matches: processedMatches });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ success: false, message: 'Failed to get matches' });
  }
});

// Get users I liked
router.get('/my-likes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [likes] = await db.execute(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.age, u.bio, u.country, u.state, u.city, u.photos,
              l.created_at as liked_at,
              CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END as matched
       FROM likes l
       JOIN users u ON u.id = l.liked_id
       LEFT JOIN matches m ON (m.user1_id = LEAST(l.liker_id, l.liked_id) AND m.user2_id = GREATEST(l.liker_id, l.liked_id))
       WHERE l.liker_id = ?
       ORDER BY l.created_at DESC`,
      [userId]
    );

    // Parse photos JSON for each liked user
    const processedLikes = likes.map(like => ({
      ...like,
      photos: like.photos ? JSON.parse(like.photos) : [],
      matched: Boolean(like.matched)
    }));

    res.json({ success: true, likes: processedLikes });
  } catch (error) {
    console.error('Get my likes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get likes' });
  }
});

// Get users who liked me
router.get('/likes-me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [likes] = await db.execute(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.age, u.bio, u.country, u.state, u.city, u.photos,
              l.created_at as liked_at,
              EXISTS(SELECT 1 FROM likes WHERE liker_id = ? AND liked_id = u.id) as liked_back
       FROM likes l
       JOIN users u ON u.id = l.liker_id
       WHERE l.liked_id = ?
       ORDER BY l.created_at DESC`,
      [userId, userId]
    );

    // Parse photos JSON for each liker
    const processedLikes = likes.map(like => ({
      ...like,
      photos: like.photos ? JSON.parse(like.photos) : []
    }));

    res.json({ success: true, likes: processedLikes });
  } catch (error) {
    console.error('Get likes me error:', error);
    res.status(500).json({ success: false, message: 'Failed to get likes' });
  }
});

export default router;
