import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const DB_PATH = process.env.DB_PATH || './data/jobs.db';

let db = null;

export async function initializeDatabase() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Create database connection
    db = new sqlite3.Database(DB_PATH);
    
    // Create jobs table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          company TEXT NOT NULL,
          location TEXT,
          url TEXT UNIQUE NOT NULL,
          description TEXT,
          source TEXT NOT NULL,
          posted_date TEXT,
          scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notified BOOLEAN DEFAULT FALSE
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    logger.info('✅ Database initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

export async function saveJob(job) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT OR IGNORE INTO jobs (title, company, location, url, description, source, posted_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
      job.title,
      job.company,
      job.location,
      job.url,
      job.description,
      job.source,
      job.postedDate
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0); // Returns true if a new row was inserted
      }
    });
  });
}

export async function getJobByUrl(url) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM jobs WHERE url = ?', [url], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export async function markJobAsNotified(jobId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE jobs SET notified = TRUE WHERE id = ?', [jobId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function getUnnotifiedJobs() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM jobs WHERE notified = FALSE ORDER BY scraped_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export async function getJobStats() {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN notified = TRUE THEN 1 END) as notified,
        COUNT(CASE WHEN notified = FALSE THEN 1 END) as pending
      FROM jobs
    `, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
