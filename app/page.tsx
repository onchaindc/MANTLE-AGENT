"use client";

import { useState, useRef, useEffect } from "react";

const SUGGESTED = [
  "What is happening with RWA on Mantle right now?",
  "Explain the SPCXx SpaceX tokenization on Mantle",
  "What is the distribution problem in onchain finance?",
  "How does Mantle compare to other RWA chains?",
  "What is the current MNT token price and ecosystem TVL?",
  "Explain Mantle's agent infrastructure stack",
];

type Message = { role: "user" | "assistant"; content: string };
type LiveData = {
  mntPrice?: number;
  mntChange?: number;
  mantleTVL?: number;
  rwaTokens?: { name: string; symbol: string; price: number; change24h: number }[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function sendQuery(query: string) {
    if (!query.trim() || loading) return;
    setError("");
    const userMsg: Message = { role: "user", content: query };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history: messages }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([...newMessages, { role: "assistant", content: data.response }]);
      if (data.liveData) setLiveData(data.liveData);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const fmtB = (n?: number) => n !== undefined ? (n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : `$${(n/1e6).toFixed(1)}M`) : "—";

  return (
    <div style={{ minHeight: "100vh", background: "#080C0A", display: "flex", flexDirection: "column" }}>

      <header style={{ borderBottom: "1px solid #1A2A1C", padding: "0 32px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080C0A", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "28px", height: "28px", background: "#6CFF4A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#080C0A", fontFamily: "var(--font-mono)" }}>M</span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "3px", color: "#EEF5F0", textTransform: "uppercase" }}>Mantle Research Agent</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6CFF4A" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#4A6650", letterSpacing: "2px", textTransform: "uppercase" }}>Live Data</span>
        </div>
      </header>

      {liveData && (
        <div style={{ borderBottom: "1px solid #1A2A1C", padding: "10px 32px", display: "flex", gap: "24px", background: "#0A0E0B", overflowX: "auto" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#4A6650" }}>MNT</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#EEF5F0", fontWeight: 700 }}>${liveData.mntPrice?.toFixed(4) ?? "—"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: (liveData.mntChange ?? 0) >= 0 ? "#6CFF4A" : "#FF4A4A" }}>{(liveData.mntChange ?? 0) >= 0 ? "+" : ""}{liveData.mntChange?.toFixed(2)}%</span>
          </div>
          <div style={{ width: "1px", background: "#1A2A1C" }} />
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#4A6650" }}>MANTLE TVL</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#EEF5F0", fontWeight: 700 }}>{fmtB(liveData.mantleTVL)}</span>
          </div>
          {liveData.rwaTokens?.map((t) => (
            <div key={t.symbol} style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: "1px", background: "#1A2A1C" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#4A6650" }}>{t.symbol}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#EEF5F0" }}>${t.price?.toFixed(4)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: (t.change24h ?? 0) >= 0 ? "#6CFF4A" : "#FF4A4A" }}>{(t.change24h ?? 0) >= 0 ? "+" : ""}{t.change24h?.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: "860px", width: "100%", margin: "0 auto", padding: "0 24px" }}>

        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "60px" }}>
            <div style={{ marginBottom: "48px" }}>
              <div style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10px", color: "#3DBF22", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px", borderLeft: "2px solid #6CFF4A", paddingLeft: "12px" }}>
                Mantle Research Challenge — Track 2
              </div>
              <h1 style={{ fontSize: "36px", fontWeight: 700, color: "#EEF5F0", lineHeight: 1.15, marginBottom: "16px", maxWidth: "560px" }}>
                Research Mantle and RWA markets with live onchain data.
              </h1>
              <p style={{ fontSize: "15px", color: "#4A6650", lineHeight: 1.7, maxWidth: "520px" }}>
                Ask about Mantle ecosystem metrics, tokenized real-world assets, the RWA distribution layer, or anything moving in onchain finance. Live data from DeFiLlama and CoinGecko, synthesized in real time.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "40px" }}>
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => sendQuery(s)} style={{ background: "#0F1611", border: "1px solid #1A2A1C", padding: "14px 16px", textAlign: "left", cursor: "pointer", color: "#4A6650", fontSize: "13px", lineHeight: 1.5, fontFamily: "var(--font-sans)", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget.style.borderColor = "#6CFF4A"); (e.currentTarget.style.color = "#EEF5F0"); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.borderColor = "#1A2A1C"); (e.currentTarget.style.color = "#4A6650"); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div style={{ flex: 1, paddingTop: "32px", paddingBottom: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: m.role === "user" ? "#1A2A1C" : "#6CFF4A", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: m.role === "user" ? "#4A6650" : "#080C0A" }}>
                  {m.role === "user" ? "YOU" : "AI"}
                </div>
                <div style={{ flex: 1 }}>
                  {m.role === "user" ? (
                    <p style={{ fontSize: "15px", color: "#EEF5F0", lineHeight: 1.6, paddingTop: "4px" }}>{m.content}</p>
                  ) : (
                    <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", borderTop: "2px solid #6CFF4A", padding: "24px 28px" }}>
                      <pre style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#C8D8CC", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#6CFF4A", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: "#080C0A" }}>AI</div>
                <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", borderTop: "2px solid #6CFF4A", padding: "20px 28px", display: "flex", gap: "6px", alignItems: "center" }}>
                  {[0,1,2].map((i) => <div key={i} style={{ width: "6px", height: "6px", background: "#6CFF4A", borderRadius: "50%", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            )}

            {error && <div style={{ background: "#1A0A0A", border: "1px solid #3A1A1A", padding: "14px 18px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#FF6A6A" }}>Error: {error}</div>}
            <div ref={bottomRef} />
          </div>
        )}

        <div style={{ position: "sticky", bottom: 0, background: "#080C0A", borderTop: "1px solid #1A2A1C", paddingTop: "16px", paddingBottom: "24px" }}>
          <div style={{ display: "flex", border: "1px solid #1A2A1C", background: "#0F1611" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendQuery(input)}
              placeholder="Ask about Mantle, RWAs, tokenized equities, ecosystem metrics..."
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "16px 20px", color: "#EEF5F0", fontSize: "14px", fontFamily: "var(--font-sans)" }} />
            <button onClick={() => sendQuery(input)} disabled={loading || !input.trim()}
              style={{ background: loading || !input.trim() ? "#1A2A1C" : "#6CFF4A", border: "none", padding: "16px 24px", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: loading || !input.trim() ? "#4A6650" : "#080C0A", letterSpacing: "2px", textTransform: "uppercase", transition: "all 0.15s" }}>
              {loading ? "..." : "Research"}
            </button>
          </div>
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "9px", color: "#2A3A2C", letterSpacing: "1px" }}>
            <span>POWERED BY GROQ + LLAMA 3.3 70B</span>
            <span>LIVE: DEFILLAMA + COINGECKO</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
