import express from 'express';
import { body, validationResult } from 'express-validator';
import Database from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

const router = express.Router();
const db = Database.getInstance().getConnection();

// Get all users with public profiles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    // Get current user's gender and preferences
    const [currentUser] = await db.execute(
      'SELECT gender, looking_for FROM users WHERE id = ?',
      [req.user.id]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userGender = currentUser[0].gender;
    const userLookingFor = currentUser[0].looking_for;

    // Determine genders to show based on looking_for
    let gendersToShow = [];
    if (userLookingFor === 'male') {
      gendersToShow = ['male'];
    } else if (userLookingFor === 'female') {
      gendersToShow = ['female'];
    } else if (userLookingFor === 'both') {
      gendersToShow = ['male', 'female'];
    }

    // Build gender IN clause
    const genderPlaceholders = gendersToShow.map(() => '?').join(',');
    const countQuery = `SELECT COUNT(*) as total FROM users
       WHERE id != ?
       AND gender IN (${genderPlaceholders})
       AND looking_for IN (?, 'both')`;
    const countParams = [req.user.id, ...gendersToShow, userGender];

    const [countResult] = await db.execute(countQuery, countParams);
    const totalUsers = countResult[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    // Get paginated users with gender filtering
    const selectQuery = `SELECT id, username, first_name, last_name, age, gender, bio, country, state, city, profile_image, photos, created_at
       FROM users
       WHERE id != ?
       AND gender IN (${genderPlaceholders})
       AND looking_for IN (?, 'both')
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`;
    const selectParams = [req.user.id, ...gendersToShow, userGender, limit, offset];

    const [users] = await db.execute(selectQuery, selectParams);

    // Parse photos JSON for each user
    const processedUsers = users.map(user => {
      try {
        if (user.photos) {
          user.photos = JSON.parse(user.photos);
        } else {
          user.photos = [];
        }
      } catch (parseError) {
        console.error('Error parsing photos for user', user.id, ':', parseError);
        user.photos = [];
      }
      return user;
    });

    res.json({
      success: true,
      users: processedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get users' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute(
  'SELECT id, username, email, first_name, last_name, age, gender, looking_for as interested_in, bio, country, state, city, interests, photos, profile_image, is_premium, created_at, email_notifications, push_notifications, profile_visibility, theme FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    // Parse interests JSON if it exists
    try {
      if (user.interests) {
        user.interests = JSON.parse(user.interests);
      } else {
        user.interests = [];
      }
    } catch (parseError) {
      console.error('Error parsing interests for user', user.id, ':', parseError);
      user.interests = [];
    }

    // Parse photos JSON if it exists
    try {
      if (user.photos) {
        user.photos = JSON.parse(user.photos);
      } else {
        user.photos = [];
      }
    } catch (parseError) {
      console.error('Error parsing photos for user', user.id, ':', parseError);
      user.photos = [];
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('age').optional().isInt({ min: 18, max: 100 }).withMessage('Age must be between 18 and 100'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('interestedIn').optional().isIn(['male', 'female', 'both']).withMessage('Invalid preference'),
  body('country').optional().notEmpty().withMessage('Country cannot be empty'),
  body('state').optional().notEmpty().withMessage('State cannot be empty'),
  body('city').optional().notEmpty().withMessage('City cannot be empty'),
  body('photos').optional().isArray().withMessage('Photos must be an array'),
  body('emailNotifications').optional().isBoolean().withMessage('Email notifications must be boolean'),
  body('pushNotifications').optional().isBoolean().withMessage('Push notifications must be boolean'),
  body('profileVisibility').optional().isIn(['public', 'matches', 'private']).withMessage('Invalid profile visibility'),
  body('theme').optional().isIn(['light', 'dark', 'auto']).withMessage('Invalid theme')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { firstName, lastName, age, gender, interestedIn, bio, country, state, city, photos, emailNotifications, pushNotifications, profileVisibility, theme } = req.body;
    const userId = req.user.id;

    const updateFields = [];
    const updateValues = [];

    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      updateValues.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      updateValues.push(lastName);
    }
    if (age !== undefined) {
      updateFields.push('age = ?');
      updateValues.push(age);
    }
    if (gender !== undefined) {
      updateFields.push('gender = ?');
      updateValues.push(gender);
    }
    if (interestedIn !== undefined) {
      updateFields.push('looking_for = ?');
      updateValues.push(interestedIn);
    }
    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio);
    }
    if (country !== undefined) {
      updateFields.push('country = ?');
      updateValues.push(country);
    }
    if (state !== undefined) {
      updateFields.push('state = ?');
      updateValues.push(state);
    }
    if (city !== undefined) {
      updateFields.push('city = ?');
      updateValues.push(city);
    }
    if (photos !== undefined) {
      updateFields.push('photos = ?');
      updateValues.push(JSON.stringify(photos));
      updateFields.push('profile_image = ?');
      updateValues.push(photos.length > 0 ? photos[0] : null);
    }
    if (emailNotifications !== undefined) {
      updateFields.push('email_notifications = ?');
      updateValues.push(emailNotifications);
    }
    if (pushNotifications !== undefined) {
      updateFields.push('push_notifications = ?');
      updateValues.push(pushNotifications);
    }
    if (profileVisibility !== undefined) {
      updateFields.push('profile_visibility = ?');
      updateValues.push(profileVisibility);
    }
    if (theme !== undefined) {
      updateFields.push('theme = ?');
      updateValues.push(theme);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.execute(query, updateValues);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Cannot view your own profile this way' });
    }

    // Check if users are matched or if profile is public
    const [userCheck] = await db.execute(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.age, u.gender, u.bio, u.country, u.state, u.city, u.interests, u.photos, u.profile_image, u.created_at, u.profile_visibility,
              CASE
                WHEN u.profile_visibility = 'public' THEN 1
                WHEN u.profile_visibility = 'matches' AND EXISTS(
                  SELECT 1 FROM likes l1 JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
                  WHERE l1.liker_id = ? AND l1.liked_id = u.id
                ) THEN 1
                ELSE 0
              END as can_view
       FROM users u
       WHERE u.id = ?`,
      [currentUserId, userId]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userCheck[0];

    if (!user.can_view) {
      return res.status(403).json({ success: false, message: 'This profile is private. Try liking them to create a match and unlock their full profile!' });
    }

    // Parse interests JSON if it exists
    try {
      if (user.interests) {
        user.interests = JSON.parse(user.interests);
      } else {
        user.interests = [];
      }
    } catch (parseError) {
      console.error('Error parsing interests for user', user.id, ':', parseError);
      user.interests = [];
    }

    // Parse photos JSON if it exists
    try {
      if (user.photos) {
        user.photos = JSON.parse(user.photos);
      } else {
        user.photos = [];
      }
    } catch (parseError) {
      console.error('Error parsing photos for user', user.id, ':', parseError);
      user.photos = [];
    }

    // Remove sensitive fields
    delete user.can_view;

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to get user' });
  }
});

// Get potential matches
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current user's preferences
    const [currentUser] = await db.execute(
      'SELECT gender, looking_for as interested_in FROM users WHERE id = ?',
      [userId]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userPrefs = currentUser[0];

    // Find potential matches
    const [matches] = await db.execute(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.age, u.bio, u.country, u.state, u.city, u.profile_image,
              (SELECT COUNT(*) FROM likes WHERE liker_id = ? AND liked_id = u.id) as is_liked,
              (SELECT COUNT(*) FROM favorites WHERE user_id = ? AND favorite_user_id = u.id) as is_favorited
       FROM users u
       WHERE u.id != ?
       AND u.gender = ?
       AND u.looking_for IN (?, 'both')
       AND u.id NOT IN (SELECT liked_id FROM likes WHERE liker_id = ?)
       ORDER BY RAND()
       LIMIT 12`,
      [userId, userId, userId, userPrefs.interested_in, userPrefs.gender, userId]
    );

    res.json({ success: true, matches });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ success: false, message: 'Failed to get matches' });
  }
});

// Update user password
router.put('/password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').matches(/^(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/).withMessage('New password must be at least 8 characters long, contain at least one uppercase letter, and one special character (!@#$%^&*)'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match new password');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current user password
    const [users] = await db.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.execute(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedNewPassword, userId]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ success: false, message: 'Failed to update password' });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;

    // Start transaction to ensure all related data is deleted
    await connection.beginTransaction();

    try {
      // Delete user's conversations (this will cascade delete all messages in those conversations)
      await connection.execute('DELETE FROM conversations WHERE user1_id = ? OR user2_id = ?', [userId, userId]);

      // Delete user's likes (both given and received)
      await connection.execute('DELETE FROM likes WHERE liker_id = ? OR liked_id = ?', [userId, userId]);

      // Delete user's favorites (both as favoriter and favoritee)
      await connection.execute('DELETE FROM favorites WHERE user_id = ? OR favorite_user_id = ?', [userId, userId]);

      // Delete user's notifications
      await connection.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);

      // Finally, delete the user account
      const [deleteResult] = await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

      if (deleteResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Commit the transaction
      await connection.commit();

      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      // Rollback on any error
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  } finally {
    connection.release();
  }
});

export default router;
