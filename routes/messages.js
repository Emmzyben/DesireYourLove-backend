import express from 'express';
import { body, validationResult } from 'express-validator';
import Database from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { io } from '../server.js';
import EmailService from '../services/emailService.js';

const router = express.Router();
const db = Database.getInstance().getConnection();
const emailService = new EmailService();

// Get user's conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [conversations] = await db.execute(
      `SELECT c.id, c.last_message_at,
              u.id as other_user_id, u.username, u.first_name, u.last_name, u.profile_image,
              m.message as last_message, m.sender_id, m.created_at as message_time,
              CASE WHEN m.sender_id = ? THEN 1 ELSE 0 END as is_from_me,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0) as unread_count
       FROM conversations c
       JOIN users u ON (u.id = c.user1_id OR u.id = c.user2_id) AND u.id != ?
       LEFT JOIN messages m ON m.conversation_id = c.id AND m.id = (
         SELECT MAX(id) FROM messages WHERE conversation_id = c.id
       )
       WHERE (c.user1_id = ? OR c.user2_id = ?)
       ORDER BY c.last_message_at DESC`,
      [userId, userId, userId, userId, userId]
    );

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get conversations' });
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.conversationId);

    // Verify user is part of this conversation
    const [conversation] = await db.execute(
      'SELECT user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, userId, userId]
    );

    if (conversation.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Mark messages as read
    await db.execute(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?',
      [conversationId, userId]
    );

    // Get messages
    const [messages] = await db.execute(
      `SELECT m.id, m.message, m.created_at, m.is_read,
              u.id as sender_id, u.first_name, u.last_name, u.profile_image,
              CASE WHEN m.sender_id = ? THEN 1 ELSE 0 END as is_from_me
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [userId, conversationId]
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
});

// Send message
router.post('/send', authenticateToken, [
  body('conversationId').isInt().withMessage('Invalid conversation ID'),
  body('message').notEmpty().withMessage('Message cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.user.id;
    const { conversationId, message } = req.body;

    // Verify user is part of this conversation
    const [conversation] = await db.execute(
      'SELECT user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, userId, userId]
    );

    if (conversation.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Insert message
    const [result] = await db.execute(
      'INSERT INTO messages (conversation_id, sender_id, message) VALUES (?, ?, ?)',
      [conversationId, userId, message]
    );

    // Update conversation last message time
    await db.execute(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
      [conversationId]
    );

    const messageId = result.insertId;

    // Get recipient ID and info
    const conv = conversation[0];
    const recipientId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;

    // Get recipient email and name for notification
    const [recipient] = await db.execute(
      'SELECT email, first_name, last_name, email_notifications FROM users WHERE id = ?',
      [recipientId]
    );

    // Get sender's name
    const [sender] = await db.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [userId]
    );
    const senderFirstName = sender[0]?.first_name || 'Someone';
    const senderLastName = sender[0]?.last_name || '';

    // Create notification
    await db.execute(
      'INSERT INTO notifications (user_id, type, from_user_id, message) VALUES (?, ?, ?, ?)',
      [recipientId, 'message', userId, `${senderFirstName} sent you a message!`]
    );

    // Send email notification only if user has email notifications enabled
    if (recipient.length > 0 && recipient[0].email_notifications) {
      const recipientData = recipient[0];
      const recipientEmail = recipientData.email;
      const recipientName = `${recipientData.first_name} ${recipientData.last_name}`;
      const senderName = `${senderFirstName} ${senderLastName}`.trim();

      // Send email notification asynchronously (don't wait for it)
      emailService.sendMessageNotification(
        recipientEmail,
        recipientName,
        senderName,
        message
      ).catch(error => {
        console.error('Failed to send email notification:', error);
      });
    }

    // Emit socket event
    const messageData = {
      id: messageId,
      message,
      created_at: new Date(),
      is_read: false,
      sender_id: userId,
      first_name: req.user.firstName,
      last_name: req.user.lastName,
      profile_image: null,
      is_from_me: 1
    };

    io.to(`conversation_${conversationId}`).emit('new_message', messageData);

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Start conversation with a user
router.post('/start-conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.userId);

    if (userId === otherUserId) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself' });
    }

    // Check if conversation already exists
    const [existing] = await db.execute(
      'SELECT id FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
      [userId, otherUserId, otherUserId, userId]
    );

    if (existing.length > 0) {
      return res.json({ success: true, conversationId: existing[0].id });
    }

    // Check if users are matched
    const [match] = await db.execute(
      'SELECT id FROM matches WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
      [userId, otherUserId, otherUserId, userId]
    );

    if (match.length === 0) {
      return res.status(403).json({ success: false, message: 'You can only message matched users' });
    }

    // Create new conversation
    const [result] = await db.execute(
      'INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)',
      [userId, otherUserId]
    );

    const conversationId = result.insertId;

    res.status(201).json({ success: true, conversationId });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to start conversation' });
  }
});

export default router;
