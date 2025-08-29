import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';
import { markJobAsNotified } from '../database/db.js';

export async function sendJobNotifications(jobs) {
  if (!jobs || jobs.length === 0) {
    logger.info('No jobs to notify about');
    return;
  }
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    // Generate email content
    const emailHtml = generateJobEmailHtml(jobs);
    const emailText = generateJobEmailText(jobs);
    
    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: `🔍 ${jobs.length} New Job${jobs.length > 1 ? 's' : ''} Found in Munich`,
      text: emailText,
      html: emailHtml
    };
    
    await transporter.sendMail(mailOptions);
    
    // Mark jobs as notified
    for (const job of jobs) {
      if (job.id) {
        await markJobAsNotified(job.id);
      }
    }
    
    logger.info(`📧 Email notification sent for ${jobs.length} jobs`);
    
  } catch (error) {
    logger.error('❌ Failed to send email notification:', error);
    throw error;
  }
}

function generateJobEmailHtml(jobs) {
  const jobsHtml = jobs.map(job => `
    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 15px 0; background-color: #f9f9f9;">
      <h3 style="color: #2c3e50; margin: 0 0 10px 0;">
        <a href="${job.url}" style="text-decoration: none; color: #3498db;">${job.title}</a>
      </h3>
      <p style="margin: 5px 0; color: #34495e;">
        <strong>Company:</strong> ${job.company}
      </p>
      <p style="margin: 5px 0; color: #34495e;">
        <strong>Location:</strong> ${job.location}
      </p>
      <p style="margin: 5px 0; color: #34495e;">
        <strong>Source:</strong> ${job.source}
      </p>
      ${job.description ? `
        <p style="margin: 10px 0 0 0; color: #7f8c8d; font-size: 14px;">
          ${job.description.substring(0, 200)}${job.description.length > 200 ? '...' : ''}
        </p>
      ` : ''}
      <p style="margin: 15px 0 0 0;">
        <a href="${job.url}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Job →
        </a>
      </p>
    </div>
  `).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Job Opportunities</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2c3e50; text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
        🔍 New Job Opportunities
      </h1>
      <p style="text-align: center; color: #7f8c8d; margin-bottom: 30px;">
        Found ${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your criteria in Munich
      </p>
      ${jobsHtml}
      <div style="margin-top: 30px; padding: 20px; background-color: #ecf0f1; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #7f8c8d; font-size: 14px;">
          This email was sent by your automated job scraper.<br>
          Jobs are checked every 12 hours for new opportunities.
        </p>
      </div>
    </body>
    </html>
  `;
}

function generateJobEmailText(jobs) {
  const jobsText = jobs.map(job => `
📋 ${job.title}
🏢 Company: ${job.company}
📍 Location: ${job.location}
🔗 Source: ${job.source}
🌐 URL: ${job.url}
${job.description ? `📝 ${job.description.substring(0, 150)}${job.description.length > 150 ? '...' : ''}` : ''}
${'='.repeat(50)}
  `).join('\n');
  
  return `
🔍 NEW JOB OPPORTUNITIES IN MUNICH

Found ${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your criteria:

${jobsText}

This email was sent by your automated job scraper.
Jobs are checked every 12 hours for new opportunities.
  `;
}
