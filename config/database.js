import mysql from 'mysql2/promise';

export class Database {
  static instance;
  pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'desireyourlove',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  getConnection() {
    return this.pool;
  }

  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      console.log('✅ Database connected successfully');
      connection.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async createTables() {
    try {
      const connection = await this.pool.getConnection();

      // Create users table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          age INT,
          gender ENUM('male', 'female', 'other'),
          looking_for ENUM('male', 'female', 'both'),
          bio TEXT,
          country VARCHAR(100),
          state VARCHAR(100),
          city VARCHAR(100),
          interests JSON,
          photos JSON,
          onboarding_completed BOOLEAN DEFAULT FALSE,
          email_verified BOOLEAN DEFAULT FALSE,
          verification_token VARCHAR(255),
          verification_token_expires TIMESTAMP NULL,
          reset_token VARCHAR(255),
          reset_token_expires TIMESTAMP NULL,
          profile_image VARCHAR(255),
          is_premium BOOLEAN DEFAULT FALSE,
          email_notifications BOOLEAN DEFAULT TRUE,
          push_notifications BOOLEAN DEFAULT FALSE,
          profile_visibility ENUM('public', 'matches', 'private') DEFAULT 'public',
          theme ENUM('light', 'dark', 'auto') DEFAULT 'light',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Add reset_token and reset_token_expires columns if they don't exist (for existing tables)
      await connection.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`);
      await connection.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP NULL`);

      // Create likes table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS likes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          liker_id INT NOT NULL,
          liked_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (liker_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (liked_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_like (liker_id, liked_id)
        )
      `);

      // Create matches table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS matches (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user1_id INT NOT NULL,
          user2_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_match (user1_id, user2_id)
        )
      `);

      // Create conversations table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user1_id INT NOT NULL,
          user2_id INT NOT NULL,
          last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_conversation (user1_id, user2_id)
        )
      `);

      // Create messages table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          sender_id INT NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create favorites table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          favorite_user_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (favorite_user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_favorite (user_id, favorite_user_id)
        )
      `);

      // Create notifications table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          type ENUM('like', 'match', 'message') NOT NULL,
          from_user_id INT,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      console.log('✅ Database tables created successfully');
      connection.release();
    } catch (error) {
      console.error('❌ Failed to create database tables:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

export default Database;
