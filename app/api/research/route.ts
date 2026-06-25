import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fetchMantleTVL() {
  try {
    const res = await fetch("https://api.llama.fi/protocol/mantle", {
      next: { revalidate: 300 },
    });
    const data = await res.json();
    return {
      tvl: data.currentChainTvls?.Mantle ?? null,
      name: data.name ?? "Mantle",
    };
  } catch {
    return null;
  }
}

async function fetchRWAData() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=real-world-assets-rwa&order=market_cap_desc&per_page=8&page=1",
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    return data.map((c: any) => ({
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      price: c.current_price,
      marketCap: c.market_cap,
      change24h: c.price_change_percentage_24h,
    }));
  } catch {
    return null;
  }
}

async function fetchMantleToken() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/mantle?localization=false&tickers=false&community_data=false&developer_data=false",
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    return {
      price: data.market_data?.current_price?.usd,
      marketCap: data.market_data?.market_cap?.usd,
      change24h: data.market_data?.price_change_percentage_24h,
      volume: data.market_data?.total_volume?.usd,
    };
  } catch {
    return null;
  }
}

async function fetchTopDeFiLlamaChains() {
  try {
    const res = await fetch("https://api.llama.fi/v2/chains", {
      next: { revalidate: 300 },
    });
    const data = await res.json();
    const mantle = data.find((c: any) =>
      c.name?.toLowerCase().includes("mantle")
    );
    return mantle ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query, history } = await req.json();

    const [mantleTVL, rwaTokens, mntToken, mantleChain] = await Promise.all([
      fetchMantleTVL(),
      fetchRWAData(),
      fetchMantleToken(),
      fetchTopDeFiLlamaChains(),
    ]);

    const liveContext = `
LIVE ONCHAIN DATA (fetched right now):

MNT Token:
- Price: $${mntToken?.price?.toFixed(4) ?? "N/A"}
- Market Cap: $${mntToken?.marketCap ? (mntToken.marketCap / 1e9).toFixed(2) + "B" : "N/A"}
- 24h Change: ${mntToken?.change24h?.toFixed(2) ?? "N/A"}%
- 24h Volume: $${mntToken?.volume ? (mntToken.volume / 1e6).toFixed(1) + "M" : "N/A"}

Mantle Network TVL (DeFiLlama):
- Current TVL: $${mantleChain?.tvl ? (mantleChain.tvl / 1e6).toFixed(1) + "M" : mantleTVL?.tvl ? (mantleTVL.tvl / 1e6).toFixed(1) + "M" : "N/A"}

Top RWA Tokens by Market Cap right now:
${
  rwaTokens
    ?.slice(0, 6)
    .map(
      (t: any) =>
        `- ${t.name} (${t.symbol}): $${t.price?.toFixed(4)} | MCap: $${(t.marketCap / 1e6).toFixed(1)}M | 24h: ${t.change24h?.toFixed(2)}%`
    )
    .join("\n") ?? "N/A"
}

Known Mantle Ecosystem Context (Q1 2026):
- RWA TVL on Mantle: $247.5M (+27.4% QoQ)
- Maple Finance syrupUSDT via Aave: $90.1M TVL
- Aave lending and borrowing on Mantle: $1.34B (first month)
- Mantle ranked 3rd largest Aave market globally
- Mantle Treasury: $2.4B (largest DAO treasury globally)
- Tokenized SpaceX (SPCXx) by xStocks: live on Mantle
- Fluxion Atomic RFQ system: live for tokenized equities
- Merchant Moe Project X: 100K MNT in LP rewards for SPCXx/USDT0
- InsightX AI prediction market: live on Mantle
- ERC-8004 agent identity standard: shipped
- AI Agent Skills, Agent Scaffold, x402 payments via QuestFlow: shipped
- Total tokenized RWAs (excl. stablecoins): ~$19.3B globally
- BCG/Ripple forecast: $18.9T by 2033
`;

    const systemPrompt = `You are a specialized Mantle Network and RWA (Real World Assets) research agent. You have access to live onchain data and deep knowledge of the Mantle ecosystem, tokenized assets, DeFi protocols, and onchain finance trends.

Your job is to provide sharp, data-grounded research on:
1. Mantle Network ecosystem (TVL, protocols, RWA activity, MNT token)
2. RWA market trends (tokenized equities, Treasuries, private credit)
3. Onchain finance narratives (distribution bottlenecks, composability, agent infrastructure)

${liveContext}

Always lead with the most relevant live data point for the query. Be direct, specific, and analytical. No hype. Cite numbers where available. When discussing Mantle specifically, connect ecosystem developments to the broader distribution thesis: issuance is solved, distribution is the hard problem. Format your response with clear sections using plain text headers (no markdown symbols like ** or ##). Keep responses focused and scannable.`;

    const messages = [
      ...(history ?? []),
      { role: "user" as const, content: query },
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.4,
      max_tokens: 1200,
    });

    const response = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({
      response,
      liveData: {
        mntPrice: mntToken?.price,
        mntChange: mntToken?.change24h,
        mantleTVL: mantleChain?.tvl ?? mantleTVL?.tvl,
        rwaTokens: rwaTokens?.slice(0, 4),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
