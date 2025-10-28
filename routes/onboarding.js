import express from 'express';
import { body, validationResult } from 'express-validator';
import Database from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const db = Database.getInstance().getConnection();

// Update user onboarding data
router.post('/complete', authenticateToken, [
  body('interests').isArray().withMessage('Interests must be an array'),
  body('location').optional().isString().withMessage('Location must be a string'),
  body('country').optional().isString().withMessage('Country must be a string'),
  body('state').optional().isString().withMessage('State must be a string'),
  body('city').optional().isString().withMessage('City must be a string'),
  body('bio').optional().isString().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('age').optional().isInt({ min: 18, max: 100 }).withMessage('Age must be between 18 and 100'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('lookingFor').optional().isIn(['male', 'female', 'both']).withMessage('Invalid preference'),
  body('photos').optional().isArray().withMessage('Photos must be an array'),
  body('photos.*').optional().isString().withMessage('Each photo must be a string URL'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.user.id;
    const { interests, location, country, state, city, bio, age, gender, lookingFor, photos } = req.body;

    // Update user with onboarding data
    const updateFields = [];
    const updateValues = [];

    if (interests) {
      updateFields.push('interests = ?');
      updateValues.push(JSON.stringify(interests));
    }
    if (location) {
      updateFields.push('location = ?');
      updateValues.push(location);
    }
    if (country) {
      updateFields.push('country = ?');
      updateValues.push(country);
    }
    if (state) {
      updateFields.push('state = ?');
      updateValues.push(state);
    }
    if (city) {
      updateFields.push('city = ?');
      updateValues.push(city);
    }
    if (bio) {
      updateFields.push('bio = ?');
      updateValues.push(bio);
    }
    if (age) {
      updateFields.push('age = ?');
      updateValues.push(age);
    }
    if (gender) {
      updateFields.push('gender = ?');
      updateValues.push(gender);
    }
    if (lookingFor) {
      updateFields.push('looking_for = ?');
      updateValues.push(lookingFor);
    }
    if (photos) {
      updateFields.push('photos = ?');
      updateValues.push(JSON.stringify(photos));
    }

    // Mark onboarding as complete
    updateFields.push('onboarding_completed = ?');
    updateValues.push(true);

    updateValues.push(userId);

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

    await db.execute(query, updateValues);

    res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete onboarding' });
  }
});

// Get user onboarding status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await db.execute(
      'SELECT onboarding_completed, interests, photos, location, country, state, city, bio, age, gender, looking_for FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];

    res.json({
      success: true,
      onboardingCompleted: user.onboarding_completed,
      data: {
        interests: user.interests ? JSON.parse(user.interests) : [],
        photos: user.photos ? JSON.parse(user.photos) : [],
        location: user.location,
        country: user.country,
        state: user.state,
        city: user.city,
        bio: user.bio,
        age: user.age,
        gender: user.gender,
        lookingFor: user.looking_for
      }
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get onboarding status' });
  }
});

export default router;
