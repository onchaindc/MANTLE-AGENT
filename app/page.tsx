"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SUGGESTED = [
  "What is happening with RWA on Mantle right now?",
  "Explain the SPCXx SpaceX tokenization on Mantle",
  "What is the distribution problem in onchain finance?",
  "How does Mantle compare to other RWA chains?",
  "What is the current MNT token price and ecosystem TVL?",
  "Explain Mantle's agent infrastructure stack",
];

const FOLLOW_UPS = {
  more: "Tell me more about that and expand on the key implications.",
  data: "Show the supporting data, metrics, and concrete numbers behind that answer.",
};

type Message = { role: "user" | "assistant"; content: string };
type LiveToken = {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
};
type LiveData = {
  mntPrice?: number;
  mntMarketCap?: number;
  mntVolume?: number;
  mntChange?: number;
  mantleTVL?: number;
  rwaTokens?: LiveToken[];
};
type ParsedBlock = {
  type: "heading" | "paragraph";
  content: string;
};

const shellButton: React.CSSProperties = {
  background: "#0F1611",
  border: "1px solid #1A2A1C",
  color: "#C8D8CC",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  padding: "10px 14px",
  cursor: "pointer",
  transition: "all 0.15s",
};

function parseResponse(content: string): ParsedBlock[] {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      type: /:$/.test(block) ? "heading" : "paragraph",
      content: block,
    }));
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Array<HTMLDivElement | null>>([]);

  const questionHistory = useMemo(
    () => messages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => message.role === "user"),
    [messages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowHistory(window.innerWidth >= 1024);
    }
  }, []);

  async function sendQuery(query: string) {
    if (!query.trim() || loading) return;

    setError("");
    const userMsg: Message = { role: "user", content: query };
    const history = [...messages];
    const newMessages = [...history, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history }),
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

  function resetChat() {
    if (loading) return;
    setMessages([]);
    setInput("");
    setError("");
  }

  function goBack() {
    if (loading || messages.length === 0) return;

    const nextMessages = [...messages];
    const lastAssistantIndex = [...nextMessages].reverse().findIndex((message) => message.role === "assistant");

    if (lastAssistantIndex !== -1) {
      nextMessages.splice(nextMessages.length - 1 - lastAssistantIndex, 1);
    }

    const lastUserIndex = [...nextMessages].reverse().findIndex((message) => message.role === "user");

    if (lastUserIndex !== -1) {
      nextMessages.splice(nextMessages.length - 1 - lastUserIndex, 1);
    }

    setMessages(nextMessages);
    setError("");
  }

  async function copyResponse(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setError("Copy failed. Please try again.");
    }
  }

  function shareResponse(content: string) {
    const snippet = content.slice(0, 200).trim();
    const text = `${snippet} — via Mantle Research Agent mantlescout.vercel.app @Mantle_Official #Mantle #RWA`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function scrollToMessage(index: number) {
    messageRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const fmtCompact = (n?: number) => {
    if (n === undefined) return "-";
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080C0A", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid #1A2A1C", padding: "0 32px", minHeight: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080C0A", zIndex: 10, gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "28px", height: "28px", background: "#6CFF4A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#080C0A", fontFamily: "var(--font-mono)" }}>M</span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "3px", color: "#EEF5F0", textTransform: "uppercase" }}>Mantle Research Agent</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => setShowHistory((value) => !value)} style={{ ...shellButton, borderColor: showHistory ? "#6CFF4A" : "#1A2A1C", color: showHistory ? "#EEF5F0" : "#C8D8CC" }}>
            History
          </button>
          <button onClick={goBack} disabled={loading || messages.length === 0} style={{ ...shellButton, opacity: loading || messages.length === 0 ? 0.45 : 1 }}>
            Back
          </button>
          <button onClick={resetChat} disabled={loading || messages.length === 0} style={{ ...shellButton, opacity: loading || messages.length === 0 ? 0.45 : 1 }}>
            Home
          </button>
          <button onClick={resetChat} disabled={loading} style={{ ...shellButton, borderColor: "#6CFF4A", color: "#EEF5F0", opacity: loading ? 0.45 : 1 }}>
            New Chat
          </button>
          <button onClick={() => setShowLiveStats((value) => !value)} style={{ ...shellButton, borderColor: showLiveStats ? "#6CFF4A" : "#1A2A1C", color: showLiveStats ? "#EEF5F0" : "#C8D8CC" }}>
            Live Stats {showLiveStats ? "On" : "Off"}
          </button>
        </div>
      </header>

      {showLiveStats && (
        <div style={{ borderBottom: "1px solid #1A2A1C", padding: "14px 32px", background: "#0A0E0B", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#4A6650", marginBottom: "8px" }}>MNT PRICE</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", color: "#EEF5F0", fontWeight: 700 }}>${liveData?.mntPrice?.toFixed(4) ?? "-"}</div>
          </div>
          <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#4A6650", marginBottom: "8px" }}>MARKET CAP</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", color: "#EEF5F0", fontWeight: 700 }}>{fmtCompact(liveData?.mntMarketCap)}</div>
          </div>
          <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#4A6650", marginBottom: "8px" }}>24H VOLUME</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", color: "#EEF5F0", fontWeight: 700 }}>{fmtCompact(liveData?.mntVolume)}</div>
          </div>
          <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#4A6650", marginBottom: "8px" }}>MANTLE TVL</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", color: "#EEF5F0", fontWeight: 700 }}>{fmtCompact(liveData?.mantleTVL)}</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", width: "100%" }}>
        {showHistory && (
          <aside style={{ width: "280px", borderRight: "1px solid #1A2A1C", background: "#0A0E0B", padding: "24px 16px", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#6CFF4A", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>
              Session History
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {questionHistory.length === 0 && (
                <div style={{ fontSize: "13px", color: "#4A6650", lineHeight: 1.5 }}>Your questions will appear here.</div>
              )}
              {questionHistory.map(({ message, index }, historyIndex) => (
                <button
                  key={`${historyIndex}-${message.content}`}
                  onClick={() => scrollToMessage(index)}
                  style={{ background: "#0F1611", border: "1px solid #1A2A1C", color: "#4A6650", textAlign: "left", padding: "12px 14px", cursor: "pointer", fontSize: "13px", lineHeight: 1.5 }}
                >
                  {message.content}
                </button>
              ))}
            </div>
          </aside>
        )}

        <div style={{ flex: 1, maxWidth: "980px", width: "100%", margin: "0 auto", padding: "32px" }}>
          {messages.length === 0 && (
            <div style={{ paddingTop: "48px" }}>
              <h1 style={{ fontSize: "48px", lineHeight: 1, marginBottom: "18px", color: "#EEF5F0", fontWeight: 500 }}>Mantle x RWA research, with live context.</h1>
              <p style={{ fontSize: "16px", color: "#4A6650", lineHeight: 1.6, maxWidth: "720px", marginBottom: "36px" }}>
                Ask about Mantle, MNT, RWAs, tokenized equities, DeFi infrastructure, or distribution trends in onchain finance.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "40px" }}>
                {SUGGESTED.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendQuery(suggestion)}
                    style={{ background: "#0F1611", border: "1px solid #1A2A1C", padding: "14px 16px", textAlign: "left", cursor: "pointer", color: "#4A6650", fontSize: "13px", lineHeight: 1.5, fontFamily: "var(--font-sans)", transition: "all 0.15s" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#6CFF4A";
                      e.currentTarget.style.color = "#EEF5F0";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#1A2A1C";
                      e.currentTarget.style.color = "#4A6650";
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div style={{ flex: 1, paddingTop: "32px", paddingBottom: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              {messages.map((message, index) => (
                <div key={index} ref={(element) => { messageRefs.current[index] = element; }} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: message.role === "user" ? "#1A2A1C" : "#6CFF4A", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: message.role === "user" ? "#4A6650" : "#080C0A" }}>
                    {message.role === "user" ? "YOU" : "AI"}
                  </div>
                  <div style={{ flex: 1 }}>
                    {message.role === "user" ? (
                      <p style={{ fontSize: "15px", color: "#EEF5F0", lineHeight: 1.6, paddingTop: "4px" }}>{message.content}</p>
                    ) : (
                      <>
                        <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", borderTop: "2px solid #6CFF4A", padding: "24px 28px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {parseResponse(message.content).map((block, blockIndex) =>
                              block.type === "heading" ? (
                                <div key={blockIndex} style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#6CFF4A", letterSpacing: "2px", textTransform: "uppercase" }}>
                                  {block.content}
                                </div>
                              ) : (
                                <p key={blockIndex} style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "#C8D8CC", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                                  {block.content}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                          <button onClick={() => copyResponse(message.content)} style={shellButton}>Copy</button>
                          <button onClick={() => shareResponse(message.content)} style={shellButton}>Share</button>
                          <button onClick={() => sendQuery(`${message.content}\n\n${FOLLOW_UPS.more}`)} disabled={loading} style={{ ...shellButton, opacity: loading ? 0.45 : 1 }}>Tell Me More</button>
                          <button onClick={() => sendQuery(`${message.content}\n\n${FOLLOW_UPS.data}`)} disabled={loading} style={{ ...shellButton, opacity: loading ? 0.45 : 1 }}>Show Data</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#6CFF4A", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: "#080C0A" }}>AI</div>
                  <div style={{ background: "#0F1611", border: "1px solid #1A2A1C", borderTop: "2px solid #6CFF4A", padding: "20px 28px", display: "flex", gap: "6px", alignItems: "center" }}>
                    {[0, 1, 2].map((dot) => (
                      <div key={dot} style={{ width: "6px", height: "6px", background: "#6CFF4A", borderRadius: "50%", animation: `pulse 1.2s ease-in-out ${dot * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}

              {error && <div style={{ background: "#1A0A0A", border: "1px solid #3A1A1A", padding: "14px 18px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#FF6A6A" }}>Error: {error}</div>}
              <div ref={bottomRef} />
            </div>
          )}

          <div style={{ position: "sticky", bottom: 0, background: "#080C0A", borderTop: "1px solid #1A2A1C", paddingTop: "16px", paddingBottom: "24px" }}>
            <div style={{ display: "flex", border: "1px solid #1A2A1C", background: "#0F1611" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendQuery(input)}
                placeholder="Ask about Mantle, RWAs, tokenized equities, ecosystem metrics..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "16px 20px", color: "#EEF5F0", fontSize: "14px", fontFamily: "var(--font-sans)" }}
              />
              <button
                onClick={() => sendQuery(input)}
                disabled={loading || !input.trim()}
                style={{ background: loading || !input.trim() ? "#1A2A1C" : "#6CFF4A", border: "none", padding: "16px 24px", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: loading || !input.trim() ? "#4A6650" : "#080C0A", letterSpacing: "2px", textTransform: "uppercase", transition: "all 0.15s" }}
              >
                {loading ? "..." : "Research"}
              </button>
            </div>
            <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "9px", color: "#2A3A2C", letterSpacing: "1px" }}>
              <span>POWERED BY GROQ + LLAMA 3.3 70B</span>
              <span>LIVE: DEFILLAMA + COINGECKO</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        @media (max-width: 1023px) {
          aside { display: none; }
        }
      `}</style>
    </div>
  );
}
