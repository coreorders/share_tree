import sqlite3 from 'sqlite3';
import path from 'path';

// Use absolute path to the db file up one level from the Next.js root
const dbPath = path.resolve(process.cwd(), 'stocks.db');

export function getDbConnection() {
  return new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Failed to open stocks.db', err);
    }
  });
}

// Promisified DB query
export function queryDb(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
