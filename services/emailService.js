import sendEmail from './sendEmail.js';

class EmailService {

  async sendMessageNotification(
    recipientEmail,
    recipientName,
    senderName,
    messagePreview
  ) {
    try {
      const subject = `New message from ${senderName} on DesireYourLove`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💕 DesireYourLove</h1>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">You have a new message! 💌</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi <strong>${recipientName}</strong>,
            </p>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${senderName}</strong> sent you a message:
            </p>

            <div style="background: #f8f9fa; border-left: 4px solid #ff6b9d; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #333; margin: 0; font-style: italic;">
                "${messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview}"
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/messages"
                 style="background: linear-gradient(135deg, #ff6b9d, #c44569); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                💬 Reply to Message
              </a>
            </div>

            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              Don't keep them waiting! Log in to DesireYourLove to continue your conversation.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this email because you have an account on DesireYourLove.<br>
              If you no longer wish to receive these notifications, you can update your preferences in your account settings.
            </p>
          </div>
        </div>
      `;

      await sendEmail(recipientEmail, subject, html);
      console.log(`Message notification email sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Error sending message notification email:', error);
      // Don't throw error to avoid breaking message sending
    }
  }

  async sendWelcomeEmail(email, firstName) {
    try {
      const subject = `Welcome to DesireYourLove, ${firstName}!`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💕 Welcome to DesireYourLove!</h1>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${firstName}! 👋</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Welcome to DesireYourLove! We're excited to help you find your perfect match.
            </p>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Start exploring profiles and connecting with amazing people today!
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard"
                 style="background: linear-gradient(135deg, #ff6b9d, #c44569); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                🚀 Start Exploring
              </a>
            </div>

            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              Happy dating! 💕
            </p>
          </div>
        </div>
      `;

      await sendEmail(email, subject, html);
      console.log(`Welcome email sent to ${email}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  async sendPasswordResetEmail(email, firstName, resetLink) {
    try {
      const subject = `Reset your DesireYourLove password`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💕 DesireYourLove</h1>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi <strong>${firstName}</strong>,
            </p>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password for your DesireYourLove account. Click the button below to create a new password:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}"
                 style="background: linear-gradient(135deg, #ff6b9d, #c44569); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                🔑 Reset Password
              </a>
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              This link will expire in 1 hour for security reasons. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              Need help? Contact our support team at support@desireyourlove.com
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this email because a password reset was requested for your DesireYourLove account.<br>
              If you no longer wish to receive these emails, you can update your preferences in your account settings.
            </p>
          </div>
        </div>
      `;

      await sendEmail(email, subject, html);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
    }
  }

  async sendVerificationEmail(email, firstName, verificationLink) {
    try {
      const subject = `Verify your DesireYourLove account`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💕 DesireYourLove</h1>
          </div>

          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi <strong>${firstName}</strong>,
            </p>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Welcome to DesireYourLove! To complete your registration and start finding your perfect match, please verify your email address by clicking the button below:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}"
                 style="background: linear-gradient(135deg, #ff6b9d, #c44569); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                ✅ Verify Email Address
              </a>
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              This link will expire in 24 hours for security reasons. If you didn't create an account with DesireYourLove, you can safely ignore this email.
            </p>

            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              Need help? Contact our support team at support@desireyourlove.com
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              You're receiving this email because an account was created with this email address on DesireYourLove.<br>
              If you no longer wish to receive these emails, you can update your preferences in your account settings.
            </p>
          </div>
        </div>
      `;

      await sendEmail(email, subject, html);
      console.log(`Verification email sent to ${email}`);
    } catch (error) {
      console.error('Error sending verification email:', error);
    }
  }
}

export default EmailService;
