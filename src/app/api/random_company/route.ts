import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';

export async function GET() {
    try {
        // Pick a random company with market_cap > 0 (listed and meaningful)
        const rows = await queryDb(
            `SELECT corp_code, corp_name 
             FROM companies 
             WHERE market_cap > 1000000000000 AND stock_code IS NOT NULL AND stock_code != ''
             ORDER BY RANDOM() 
             LIMIT 1`
        );

        if (rows.length > 0) {
            return NextResponse.json({
                id: rows[0].corp_code,
                name: rows[0].corp_name,
                type: 'company'
            });
        }

        return NextResponse.json({ error: 'No companies found' }, { status: 404 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
