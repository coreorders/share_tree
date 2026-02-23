import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('id');

    if (!nodeId) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    try {
        // 1. Check if it's a company (by corp_code)
        const companies = await queryDb(
            'SELECT * FROM companies WHERE corp_code = ?',
            [nodeId]
        );

        if (companies.length > 0) {
            const company = companies[0];
            const isListed = !!(company.stock_code && company.close_price > 0);

            const shareholders = await queryDb(
                `SELECT shareholder_name, share_rate, shares_count 
                 FROM shareholders 
                 WHERE target_corp_code = ? AND shareholder_name != '계'
                 ORDER BY share_rate DESC`,
                [nodeId]
            );

            const holdings = await queryDb(
                `SELECT c.corp_name, c.corp_code, s.share_rate, s.shares_count, 
                        c.close_price, c.market_cap, c.stock_code
                 FROM shareholders s
                 JOIN companies c ON s.target_corp_code = c.corp_code
                 WHERE s.shareholder_name = ? AND s.shareholder_name != '계'
                 ORDER BY s.share_rate DESC`,
                [company.corp_name]
            );

            let totalListedValue = 0;
            let totalEstimatedValue = 0;
            let hasUnlisted = false;

            const processedHoldings = holdings.map((h: any) => {
                const hListed = !!(h.stock_code && h.close_price > 0);
                let exactValue = 0;
                let estimatedValue = 0;
                let isEstimated = false;

                if (hListed) {
                    if (h.shares_count && h.shares_count > 0 && h.close_price > 0) {
                        exactValue = h.shares_count * h.close_price;
                        totalListedValue += exactValue;
                    } else if (h.market_cap && h.share_rate > 0) {
                        estimatedValue = (h.market_cap * h.share_rate) / 100;
                        totalEstimatedValue += estimatedValue;
                        isEstimated = true;
                    }
                } else {
                    hasUnlisted = true;
                    if (h.market_cap && h.share_rate > 0) {
                        estimatedValue = (h.market_cap * h.share_rate) / 100;
                        isEstimated = true;
                    }
                }

                return {
                    ...h,
                    isListed: hListed,
                    value: exactValue || estimatedValue,
                    isEstimated,
                };
            });

            return NextResponse.json({
                type: 'company',
                name: company.corp_name,
                corp_code: company.corp_code,
                stock_code: company.stock_code,
                market_cap: company.market_cap,
                shares_outstanding: company.shares_outstanding,
                close_price: company.close_price,
                last_updated: company.last_updated,
                isListed,
                shareholders: shareholders.slice(0, 20),
                holdings: processedHoldings.slice(0, 20),
                totalListedValue,
                totalEstimatedValue,
                hasUnlisted,
                shareholderCount: shareholders.length,
                holdingsCount: holdings.length,
            });
        }

        // 2. Person/entity
        const personHoldings = await queryDb(
            `SELECT c.corp_name, c.corp_code, s.share_rate, s.shares_count, 
                    c.close_price, c.market_cap, c.stock_code
             FROM shareholders s
             JOIN companies c ON s.target_corp_code = c.corp_code
             WHERE s.shareholder_name = ? AND s.shareholder_name != '계'
             ORDER BY s.share_rate DESC`,
            [nodeId]
        );

        let totalListedValue = 0;
        let totalEstimatedValue = 0;
        let totalShares = 0;
        let hasUnlisted = false;

        const processedHoldings = personHoldings.map((h: any) => {
            const hListed = !!(h.stock_code && h.close_price > 0);
            let exactValue = 0;
            let estimatedValue = 0;
            let isEstimated = false;

            if (hListed) {
                if (h.shares_count && h.shares_count > 0 && h.close_price > 0) {
                    exactValue = h.shares_count * h.close_price;
                    totalListedValue += exactValue;
                    totalShares += h.shares_count;
                } else if (h.market_cap && h.share_rate > 0) {
                    estimatedValue = (h.market_cap * h.share_rate) / 100;
                    totalEstimatedValue += estimatedValue;
                    isEstimated = true;
                }
            } else {
                hasUnlisted = true;
                if (h.market_cap && h.share_rate > 0) {
                    estimatedValue = (h.market_cap * h.share_rate) / 100;
                    isEstimated = true;
                }
            }

            return {
                ...h,
                isListed: hListed,
                value: exactValue || estimatedValue,
                isEstimated,
            };
        });

        return NextResponse.json({
            type: 'person',
            name: nodeId,
            holdings: processedHoldings,
            holdingsCount: personHoldings.length,
            totalShares,
            totalListedValue,
            totalEstimatedValue,
            hasUnlisted,
        });

    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
