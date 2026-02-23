import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (!q) {
        return NextResponse.json([]);
    }

    try {
        // 1. Search companies by name
        const companies = await queryDb(
            `SELECT corp_code, corp_name, stock_code, market_cap, 'company' as type 
       FROM companies 
       WHERE corp_name LIKE ? 
       ORDER BY market_cap DESC LIMIT 10`,
            [`%${q}%`]
        );

        // 2. Search shareholders (people, governments, entities)
        const shareholders = await queryDb(
            `SELECT DISTINCT shareholder_name, 'shareholder' as type 
       FROM shareholders 
       WHERE shareholder_name LIKE ? 
       AND shareholder_name != '계'
       ORDER BY shareholder_name LIMIT 10`,
            [`%${q}%`]
        );

        // Combine and return both types
        const results = [
            ...companies.map((c: any) => ({
                id: c.corp_code,
                name: c.corp_name,
                stock_code: c.stock_code,
                market_cap: c.market_cap,
                type: 'company'
            })),
            ...shareholders
                // Filter out shareholders that are already in companies results
                .filter((s: any) => !companies.some((c: any) => c.corp_name === s.shareholder_name))
                .map((s: any) => ({
                    id: s.shareholder_name,
                    name: s.shareholder_name,
                    stock_code: null,
                    market_cap: null,
                    type: 'shareholder'
                }))
        ];

        return NextResponse.json(results.slice(0, 15));
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
