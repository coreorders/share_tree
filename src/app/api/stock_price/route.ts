import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('code');

    if (!stockCode) {
        return NextResponse.json({ error: 'code required' }, { status: 400 });
    }

    try {
        // Fetch from Naver Finance mobile API
        const res = await fetch(
            `https://m.stock.naver.com/api/stock/${stockCode}/basic`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                next: { revalidate: 60 }, // Cache for 60 seconds
            }
        );

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch stock price' }, { status: 502 });
        }

        const data = await res.json();

        // Extract relevant info
        const currentPrice = data?.stockEndPrice || data?.closePrice || null;
        const priceChange = data?.compareToPreviousClosePrice || null;
        const priceChangeRate = data?.fluctuationsRatio || null;
        const marketCap = data?.marketValue || null;
        const tradingVolume = data?.accumulatedTradingVolume || null;
        const stockName = data?.stockName || null;
        const high52w = data?.high52wPrice || null;
        const low52w = data?.low52wPrice || null;

        return NextResponse.json({
            stockCode,
            stockName,
            currentPrice: currentPrice ? parseInt(String(currentPrice).replace(/,/g, '')) : null,
            priceChange: priceChange ? parseInt(String(priceChange).replace(/,/g, '')) : null,
            priceChangeRate: priceChangeRate ? parseFloat(String(priceChangeRate)) : null,
            marketCap,
            tradingVolume,
            high52w: high52w ? parseInt(String(high52w).replace(/,/g, '')) : null,
            low52w: low52w ? parseInt(String(low52w).replace(/,/g, '')) : null,
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Stock price fetch error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
