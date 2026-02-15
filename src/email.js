const nodemailer = require('nodemailer');

class EmailService {
  constructor(database) {
    this.db = database;
    this.transporter = null;
  }

  async initialize() {
    try {
      // Get email settings from database
      const fromAddress = await this.getSetting('email_from_address');
      const fromName = await this.getSetting('email_from_name');

      if (!fromAddress) {
        console.warn('Email from address not configured - email features will be disabled');
        this.emailDisabled = true;
        return;
      }

      // Check if SMTP credentials are provided
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('SMTP credentials not configured - email features will be disabled');
        this.emailDisabled = true;
        return;
      }

      // Create transporter (configure with your email provider)
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify connection
      await this.transporter.verify();
      console.log('Email service initialized successfully');
      this.emailDisabled = false;

    } catch (error) {
      console.error('Failed to initialize email service:', error.message);
      console.warn('Email features will be disabled due to configuration issues');
      this.emailDisabled = true;
    }
  }

  async getSetting(key) {
    const setting = await this.db.get(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [key]
    );
    return setting ? setting.setting_value : null;
  }

  async getTemplate(templateName) {
    const template = await this.db.get(
      'SELECT * FROM email_templates WHERE template_name = ?',
      [templateName]
    );
    return template;
  }

  /**
   * Send invitation email to a player
   */
  async sendInvitation(invitationId) {
    try {
      // Check if email is disabled
      if (this.emailDisabled) {
        console.warn(`Email service is disabled, cannot send invitation ${invitationId}`);
        return {
          success: false,
          error: 'Email service is not configured'
        };
      }

      console.log(`Sending invitation email for ID: ${invitationId}`);

      // Get invitation details
      const invitation = await this.db.get(
        `SELECT ri.*, tr.first_name, tr.last_name, tr.email, tr.parent_name, tr.parent_email,
                t.name as team_name, t.coach_name, t.coach_email, t.season
         FROM registration_invitations ri
         JOIN tryout_registrations tr ON ri.tryout_registration_id = tr.id
         JOIN teams t ON ri.team_id = t.id
         WHERE ri.id = ?`,
        [invitationId]
      );

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Get email template
      const template = await this.getTemplate('invitation');
      if (!template) {
        throw new Error('Email template not found');
      }

      // Prepare email data
      const emailData = {
        player_name: `${invitation.first_name} ${invitation.last_name}`,
        parent_name: invitation.parent_name || `${invitation.first_name}'s Parent`,
        team_name: invitation.team_name,
        coach_name: invitation.coach_name,
        coach_email: invitation.coach_email,
        season: invitation.season,
        registration_link: invitation.registration_link,
        expiry_date: invitation.expires_at ? new Date(invitation.expires_at).toLocaleDateString() : 'N/A'
      };

      // Process template
      const subject = this.processTemplate(template.subject, emailData);
      const body = this.processTemplate(template.body, emailData);

      // Send email
      const mailOptions = {
        from: `"${await this.getSetting('email_from_name')}" <${await this.getSetting('email_from_address')}>`,
        to: invitation.parent_email || invitation.email,
        subject: subject,
        html: body
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Update invitation record
      await this.db.run(
        `UPDATE registration_invitations
         SET email_sent_at = CURRENT_TIMESTAMP, status = 'sent'
         WHERE id = ?`,
        [invitationId]
      );

      console.log(`Invitation email sent successfully to ${invitation.parent_email}`);
      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      console.error('Error sending invitation email:', error);

      // Update invitation status to failed
      await this.db.run(
        `UPDATE registration_invitations
         SET status = 'failed'
         WHERE id = ?`,
        [invitationId]
      );

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send rejection notification to coach
   */
  async sendRejectionNotification(registrationId, reason = '') {
    try {
      // Check if email is disabled
      if (this.emailDisabled) {
        console.warn(`Email service is disabled, cannot send rejection notification for registration ${registrationId}`);
        return {
          success: false,
          error: 'Email service is not configured'
        };
      }

      console.log(`Sending rejection notification for registration ID: ${registrationId}`);

      // Get registration details
      const registration = await this.db.get(
        `SELECT tr.*, t.name as team_name, t.coach_name, t.coach_email
         FROM tryout_registrations tr
         JOIN teams t ON tr.age_group = t.age_group AND tr.season = t.season
         WHERE tr.id = ?`,
        [registrationId]
      );

      if (!registration) {
        throw new Error('Registration not found');
      }

      // Send email to coach
      const mailOptions = {
        from: `"${await this.getSetting('email_from_name')}" <${await this.getSetting('email_from_address')}>`,
        to: registration.coach_email,
        subject: `Registration Update: ${registration.first_name} ${registration.last_name}`,
        html: `
          <h2>Registration Update</h2>
          <p><strong>Player:</strong> ${registration.first_name} ${registration.last_name}</p>
          <p><strong>Team:</strong> ${registration.team_name}</p>
          <p><strong>Status:</strong> <span style="color: red;">Registration Rejected</span></p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p><strong>Parent Email:</strong> ${registration.parent_email}</p>
          <p><strong>Registration Date:</strong> ${new Date(registration.registration_date).toLocaleDateString()}</p>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);

      console.log(`Rejection notification sent to coach ${registration.coach_email}`);
      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      console.error('Error sending rejection notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process email template with data
   */
  processTemplate(template, data) {
    let result = template;

    // Replace all placeholders with actual data
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }

    return result;
  }

  /**
   * Create invitation for a player
   */
  async createInvitation(tryoutRegistrationId, teamId) {
    try {
      console.log(`Creating invitation for registration ${tryoutRegistrationId} and team ${teamId}`);

      // Check if invitation already exists
      const existing = await this.db.get(
        'SELECT id FROM registration_invitations WHERE tryout_registration_id = ? AND team_id = ?',
        [tryoutRegistrationId, teamId]
      );

      if (existing) {
        throw new Error('Invitation already exists for this player and team');
      }

      // Get registration and team details
      const registration = await this.db.get(
        'SELECT * FROM tryout_registrations WHERE id = ?',
        [tryoutRegistrationId]
      );

      const team = await this.db.get(
        'SELECT * FROM teams WHERE id = ?',
        [teamId]
      );

      if (!registration || !team) {
        throw new Error('Registration or team not found');
      }

      // Generate unique registration link
      const registrationLinkBase = await this.getSetting('registration_link_base');
      const uniqueId = this.generateUniqueId();
      const registrationLink = `${registrationLinkBase}${uniqueId}`;

      // Calculate expiry date (default 7 days)
      const expiryDays = parseInt(await this.getSetting('invitation_expiry_days')) || 7;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Create invitation
      const result = await this.db.run(
        `INSERT INTO registration_invitations
         (tryout_registration_id, team_id, registration_link, expires_at)
         VALUES (?, ?, ?, ?)`,
        [tryoutRegistrationId, teamId, registrationLink, expiresAt.toISOString()]
      );

      console.log(`Invitation created with ID: ${result.id}`);
      return {
        success: true,
        invitationId: result.id,
        registrationLink,
        expiresAt: expiresAt.toISOString()
      };

    } catch (error) {
      console.error('Error creating invitation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate unique ID for registration link
   */
  generateUniqueId() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Process registration response (accept/reject)
   */
  async processRegistrationResponse(invitationId, status, notes = '') {
    try {
      console.log(`Processing registration response: ${invitationId} - ${status}`);

      // Get invitation details
      const invitation = await this.db.get(
        'SELECT * FROM registration_invitations WHERE id = ?',
        [invitationId]
      );

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      // Check if invitation has expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('Invitation has expired');
      }

      // Update invitation status
      await this.db.run(
        `UPDATE registration_invitations
         SET registration_completed_at = CURRENT_TIMESTAMP,
             status = ?
         WHERE id = ?`,
        [status === 'accepted' ? 'completed' : 'expired', invitationId]
      );

      // Record the status
      await this.db.run(
        `INSERT INTO registration_status
         (invitation_id, status, notes)
         VALUES (?, ?, ?)`,
        [invitationId, status, notes]
      );

      // Update tryout registration status
      await this.db.run(
        `UPDATE tryout_registrations
         SET status = ?
         WHERE id = ?`,
        [status === 'accepted' ? 'registered' : 'rejected', invitation.tryout_registration_id]
      );

      // Send notification to coach if rejected
      if (status === 'rejected') {
        await this.sendRejectionNotification(invitation.tryout_registration_id, notes);
      }

      return {
        success: true,
        message: `Registration ${status} successfully`
      };

    } catch (error) {
      console.error('Error processing registration response:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = EmailService;
