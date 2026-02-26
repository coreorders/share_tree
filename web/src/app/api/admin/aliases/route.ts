import sqlite3 from 'sqlite3';
import { NextResponse } from 'next/server';

function getDb() {
    return new sqlite3.Database('./stocks.db');
}

export async function GET() {
    const db = getDb();

    return new Promise((resolve) => {
        db.all('SELECT * FROM entity_aliases ORDER BY created_at DESC', (err, rows) => {
            db.close();
            if (err) {
                return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
            }
            resolve(NextResponse.json(rows));
        });
    });
}

export async function POST(req: Request) {
    try {
        const { alias_name, canonical_id } = await req.json();
        if (!alias_name || !canonical_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const db = getDb();
        return new Promise((resolve) => {
            db.run(
                'INSERT INTO entity_aliases (alias_name, canonical_id) VALUES (?, ?)',
                [alias_name, canonical_id],
                function (err) {
                    if (err) {
                        db.close();
                        return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                    }
                    const newlyInsertedId = this.lastID;
                    db.get('SELECT * FROM entity_aliases WHERE id = ?', [newlyInsertedId], (err, row) => {
                        db.close();
                        if (err) {
                            return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                        }
                        resolve(NextResponse.json(row));
                    });
                }
            );
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }

        const db = getDb();
        return new Promise((resolve) => {
            db.run('DELETE FROM entity_aliases WHERE id = ?', [id], function (err) {
                db.close();
                if (err) {
                    return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                }
                resolve(NextResponse.json({ success: true, changes: this.changes }));
            });
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
