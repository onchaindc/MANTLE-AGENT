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
    return data.map((coin: any) => ({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      marketCap: coin.market_cap,
      change24h: coin.price_change_percentage_24h,
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
    const mantle = data.find((chain: any) =>
      chain.name?.toLowerCase().includes("mantle")
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
      (token: any) =>
        `- ${token.name} (${token.symbol}): $${token.price?.toFixed(4)} | MCap: $${(token.marketCap / 1e6).toFixed(1)}M | 24h: ${token.change24h?.toFixed(2)}%`
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

    const systemPrompt = `You are the Mantle Scout.

First determine the user's intent before answering.

Intent rules:
- If the user sends a casual greeting or small-talk message like "hi", "hello", "hey", "gm", "good morning", "how are you", or similar, reply naturally in 1-3 short sentences.
- For casual messages, do not define RWAs, do not dump market context, and do not force Mantle analysis.
- A casual reply should briefly say you can help with Mantle, MNT, RWAs, tokenized assets, ecosystem metrics, or onchain research.
- If the user asks an actual research question, then switch into analyst mode and give the deeper Mantle/RWA answer.
- If the user message is ambiguous but not a real research question, ask a short clarifying question instead of assuming they want a full report.

When the query is a real research request, you provide sharp, data-grounded research on:
1. Mantle Network ecosystem (TVL, protocols, RWA activity, MNT token)
2. RWA market trends (tokenized equities, Treasuries, private credit)
3. Onchain finance narratives (distribution bottlenecks, composability, agent infrastructure)

${liveContext}

Research response rules:
- Lead with the most relevant live data point when it helps answer the query.
- Be direct, specific, and analytical. No hype.
- Cite numbers where available.
- When discussing Mantle specifically, connect ecosystem developments to the broader distribution thesis: issuance is solved, distribution is the hard problem.
- Format research responses with clear plain-text section headers and keep them focused and scannable.
- Do not use markdown heading symbols like ** or ## in section headers.`;

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
        mntMarketCap: mntToken?.marketCap,
        mntVolume: mntToken?.volume,
        mntChange: mntToken?.change24h,
        mantleTVL: mantleChain?.tvl ?? mantleTVL?.tvl,
        rwaTokens: rwaTokens?.slice(0, 4),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
