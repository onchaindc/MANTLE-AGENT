"use client";

import { useEffect, useRef, useState } from "react";

const QUICK_ACTIONS = [
  {
    label: "TVL Snapshot",
    query: "Give me a concise TVL snapshot for Mantle, including current TVL, major protocols, and what changed recently.",
  },
  {
    label: "Token Lookup",
    query: "Look up MNT and summarize price, market cap, volume, and the most relevant token context.",
  },
  {
    label: "Yield Scan",
    query: "Scan Mantle yield opportunities and explain the strongest current risk-adjusted options.",
  },
  {
    label: "Protocol Compare",
    query: "Compare the leading Mantle protocols by traction, TVL, and relevance to RWAs or onchain finance.",
  },
  {
    label: "Market Pulse",
    query: "Give me a quick market pulse for Mantle, MNT, RWAs, and onchain finance trends today.",
  },
];

const FOLLOW_UPS = {
  more: "Tell me more about that and expand on the key implications.",
  data: "Show the supporting data, metrics, and concrete numbers behind that answer.",
};

const THEME_STORAGE_KEY = "mantle-scout-theme";

type Theme = "dark" | "light";
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
type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  persisted: boolean;
};
const shellButton: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  color: "var(--text-soft)",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  padding: "10px 14px",
  cursor: "pointer",
  transition: "all 0.15s",
};

const logoImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

function createConversationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `conversation_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createConversation(partial?: Partial<Conversation>): Conversation {
  const now = new Date().toISOString();

  return {
    id: partial?.id ?? createConversationId(),
    title: partial?.title ?? "New Chat",
    messages: partial?.messages ?? [],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
    persisted: partial?.persisted ?? false,
  };
}

function conversationTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();

  if (!firstUserMessage) {
    return "New Chat";
  }

  return firstUserMessage.length > 40 ? `${firstUserMessage.slice(0, 37)}...` : firstUserMessage;
}

function parseResponse(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split(/\r?\n/);
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: "paragraph", content: paragraphLines.join("\n").trim() });
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (trimmed.endsWith(":")) {
      flushParagraph();
      blocks.push({ type: "heading", content: trimmed });
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return blocks;
}

function formatCompact(n?: number) {
  if (n === undefined) return "-";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(2)}`;
}

function truncateTitle(title: string) {
  return title.length > 40 ? `${title.slice(0, 37)}...` : title;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5V5.5M12 18.5V21.5M2.5 12H5.5M18.5 12H21.5M5.2 5.2L7.3 7.3M16.7 16.7L18.8 18.8M18.8 5.2L16.7 7.3M7.3 16.7L5.2 18.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M19 14.7A7.5 7.5 0 0 1 9.3 5a8.4 8.4 0 1 0 9.7 9.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const initialConversationRef = useRef<Conversation>(createConversation());
  const [theme, setTheme] = useState<Theme>("dark");
  const [isMobile, setIsMobile] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(() => [initialConversationRef.current]);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationRef.current.id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const conversationList = [...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversationId, messages.length, loading]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    setTheme(storedTheme === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setShowHistory(true);
    }
  }, []);

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth <= 767);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  function selectConversation(conversationId: string) {
    setActiveConversationId(conversationId);
  }

  function startNewConversation() {
    if (loading) return;

    const nextConversation = createConversation();
    setConversations((current) => [nextConversation, ...current]);
    setActiveConversationId(nextConversation.id);
    setInput("");
    setError("");
  }

  function goHome() {
    if (loading || !activeConversation) return;

    const resetConversation: Conversation = {
      ...activeConversation,
      title: "New Chat",
      messages: [],
      updatedAt: new Date().toISOString(),
    };

    setConversations((current) => current.map((conversation) => conversation.id === resetConversation.id ? resetConversation : conversation));
    setInput("");
    setError("");

  }

  function goBack() {
    if (loading || !activeConversation) return;

    const nextMessages = [...activeConversation.messages];
    const lastAssistantIndex = [...nextMessages].reverse().findIndex((message) => message.role === "assistant");

    if (lastAssistantIndex !== -1) {
      nextMessages.splice(nextMessages.length - 1 - lastAssistantIndex, 1);
    }

    const lastUserIndex = [...nextMessages].reverse().findIndex((message) => message.role === "user");

    if (lastUserIndex !== -1) {
      nextMessages.splice(nextMessages.length - 1 - lastUserIndex, 1);
    }

    const nextConversation = {
      ...activeConversation,
      title: conversationTitle(nextMessages),
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    };

    setConversations((current) => current.map((conversation) => conversation.id === nextConversation.id ? nextConversation : conversation));
    setError("");

  }

  async function sendQuery(query: string) {
    if (!query.trim() || loading || !activeConversation) return;

    setError("");
    setLoading(true);

    const userMessage: Message = { role: "user", content: query };
    const baseMessages = activeConversation.messages;
    const nextMessages = [...baseMessages, userMessage];
    const nextTitle = conversationTitle(nextMessages);
    const nextConversation: Conversation = {
      ...activeConversation,
      title: nextTitle,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    };

    setConversations((current) => current.map((conversation) => conversation.id === nextConversation.id ? nextConversation : conversation));
    setInput("");

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history: baseMessages }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const finalMessages = [...nextMessages, { role: "assistant" as const, content: data.response }];
      const finalConversation: Conversation = {
        ...nextConversation,
        messages: finalMessages,
        updatedAt: new Date().toISOString(),
      };

      setConversations((current) => current.map((conversation) => conversation.id === finalConversation.id ? finalConversation : conversation));
      if (data.liveData) setLiveData(data.liveData);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
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
    const text = `${snippet} - via Mantle Scout mantlescout.vercel.app @Mantle_Official #Mantle #RWA`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function renderMessageBlocks(content: string) {
    return parseResponse(content).map((block, blockIndex) =>
      block.type === "heading" ? (
        <div
          key={blockIndex}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--lime)",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          {block.content}
        </div>
      ) : (
        <p
          key={blockIndex}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            color: "var(--text-soft)",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}
        >
          {block.content}
        </p>
      )
    );
  }

  return (
    <div style={{ minHeight: "100vh", height: isMobile ? "auto" : "100dvh", overflow: isMobile ? "visible" : "hidden", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--line)", padding: isMobile ? "14px 16px" : "0 32px", minHeight: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg)", zIndex: 20, gap: isMobile ? "12px" : "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", width: isMobile ? "100%" : "auto" }}>
          <div style={{ width: "40px", height: "40px", overflow: "hidden" }}>
            <img src="/mantle-logo.png" alt="Mantle Scout logo" style={logoImageStyle} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: isMobile ? "12px" : "13px", letterSpacing: isMobile ? "3px" : "4px", color: "var(--text)", textTransform: "uppercase" }}>Mantle Scout</span>
        </div>

        <div style={{ display: isMobile ? "grid" : "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", width: isMobile ? "100%" : "auto", gridTemplateColumns: isMobile ? "repeat(3, minmax(0, 1fr))" : undefined }}>
          <button onClick={() => setShowHistory((value) => !value)} style={{ ...shellButton, borderColor: showHistory ? "var(--lime)" : "var(--line)", color: showHistory ? "var(--text)" : "var(--text-soft)", width: isMobile ? "100%" : undefined, padding: isMobile ? "10px 8px" : shellButton.padding, fontSize: isMobile ? "9px" : shellButton.fontSize, letterSpacing: isMobile ? "0.8px" : shellButton.letterSpacing }}>
            History
          </button>
          <button onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} style={{ ...shellButton, display: "flex", alignItems: "center", justifyContent: "center", minWidth: isMobile ? undefined : "44px", width: isMobile ? "100%" : undefined, padding: isMobile ? "10px 8px" : "10px 14px", color: "var(--text)", fontSize: isMobile ? "9px" : shellButton.fontSize, letterSpacing: isMobile ? "0.8px" : shellButton.letterSpacing }} aria-label="Toggle theme">
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </button>
          <button onClick={goBack} disabled={loading || messages.length === 0} style={{ ...shellButton, opacity: loading || messages.length === 0 ? 0.45 : 1, width: isMobile ? "100%" : undefined, padding: isMobile ? "10px 8px" : shellButton.padding, fontSize: isMobile ? "9px" : shellButton.fontSize, letterSpacing: isMobile ? "0.8px" : shellButton.letterSpacing }}>
            Back
          </button>
          <button onClick={startNewConversation} disabled={loading} style={{ ...shellButton, borderColor: "var(--lime)", color: "var(--text)", opacity: loading ? 0.45 : 1, width: isMobile ? "100%" : undefined, padding: isMobile ? "10px 8px" : shellButton.padding, fontSize: isMobile ? "9px" : shellButton.fontSize, letterSpacing: isMobile ? "0.8px" : shellButton.letterSpacing }}>
            New Chat
          </button>
          <button onClick={goHome} disabled={loading} style={{ ...shellButton, opacity: loading ? 0.45 : 1, width: isMobile ? "100%" : undefined, padding: isMobile ? "10px 8px" : shellButton.padding, fontSize: isMobile ? "9px" : shellButton.fontSize, letterSpacing: isMobile ? "0.8px" : shellButton.letterSpacing }}>
            Home
          </button>
          <button onClick={() => setShowLiveStats((value) => !value)} style={{ ...shellButton, borderColor: showLiveStats ? "var(--lime)" : "var(--line)", color: showLiveStats ? "var(--text)" : "var(--text-soft)", width: isMobile ? "100%" : undefined, padding: isMobile ? "10px 8px" : shellButton.padding, fontSize: isMobile ? "9px" : shellButton.fontSize, letterSpacing: isMobile ? "0.8px" : shellButton.letterSpacing }}>
            Live Stats {showLiveStats ? "On" : "Off"}
          </button>
        </div>
      </header>

      {showLiveStats && (
        <div style={{ borderBottom: "1px solid var(--line)", padding: isMobile ? "10px 16px" : "14px 32px", background: "var(--panel-soft)", display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(180px, 1fr))", gap: isMobile ? "10px" : "12px" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: isMobile ? "12px" : "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", marginBottom: "8px" }}>MNT PRICE</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: isMobile ? "16px" : "18px", color: "var(--text)", fontWeight: 700 }}>${liveData?.mntPrice?.toFixed(4) ?? "-"}</div>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: isMobile ? "12px" : "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", marginBottom: "8px" }}>MARKET CAP</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: isMobile ? "16px" : "18px", color: "var(--text)", fontWeight: 700 }}>{formatCompact(liveData?.mntMarketCap)}</div>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: isMobile ? "12px" : "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", marginBottom: "8px" }}>24H VOLUME</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: isMobile ? "16px" : "18px", color: "var(--text)", fontWeight: 700 }}>{formatCompact(liveData?.mntVolume)}</div>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", padding: isMobile ? "12px" : "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted)", marginBottom: "8px" }}>MANTLE TVL</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: isMobile ? "16px" : "18px", color: "var(--text)", fontWeight: 700 }}>{formatCompact(liveData?.mantleTVL)}</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", width: "100%", minHeight: 0, overflow: isMobile ? "visible" : "hidden" }}>
        {showHistory && (
          <aside style={{ width: "280px", borderRight: "1px solid var(--line)", background: "var(--panel-soft)", padding: "24px 16px", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lime)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>
              Conversations
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {conversationList.length === 0 && (
                <div style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>Your conversations will appear here.</div>
              )}
              {conversationList.map((conversation) => {
                const isActive = conversation.id === activeConversation?.id;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => selectConversation(conversation.id)}
                    style={{
                      background: isActive ? "var(--card)" : "transparent",
                      border: `1px solid ${isActive ? "var(--lime)" : "var(--line)"}`,
                      color: "var(--muted)",
                      textAlign: "left",
                      padding: "12px 14px",
                      cursor: "pointer",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    {truncateTitle(conversation.title)}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        <div style={{ flex: 1, maxWidth: "980px", width: "100%", margin: "0 auto", padding: messages.length === 0 ? (isMobile ? "12px 16px 10px" : "20px 32px 16px") : (isMobile ? "20px 16px 24px" : "32px"), display: "flex", flexDirection: "column", height: messages.length === 0 ? (isMobile ? (showLiveStats ? "calc(100dvh - 360px)" : "calc(100dvh - 172px)") : (showLiveStats ? "calc(100vh - 168px)" : "calc(100vh - 57px)")) : (isMobile ? "auto" : "100%"), minHeight: 0, overflow: messages.length === 0 ? "hidden" : (isMobile ? "visible" : "auto") }}>
          {messages.length === 0 && (
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "8px 0" : "12px 0", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)" }}>
                <h1 style={{ fontSize: isMobile ? "28px" : "44px", lineHeight: isMobile ? 1.18 : 1.12, color: "var(--text)", fontWeight: 400, letterSpacing: 0, margin: 0, maxWidth: isMobile ? "280px" : undefined }}>
                  What should we scout on Mantle?
                </h1>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div style={{ flex: 1, paddingTop: "32px", paddingBottom: "24px", display: "flex", flexDirection: "column", gap: "24px", minHeight: 0 }}>
              {messages.map((message, index) => (
                <div key={`${activeConversation?.id ?? "conversation"}-${index}`} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: message.role === "user" ? "var(--line)" : "var(--card)", border: message.role === "user" ? "1px solid var(--line)" : "1px solid var(--lime)", overflow: "hidden", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: "var(--muted)" }}>
                    {message.role === "user" ? "YOU" : <img src="/mantle-logo.png" alt="Mantle Scout logo" style={logoImageStyle} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    {message.role === "user" ? (
                      <p style={{ fontSize: "15px", color: "var(--text)", lineHeight: 1.6, paddingTop: "4px" }}>{message.content}</p>
                    ) : (
                      <>
                        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderTop: "2px solid var(--lime)", padding: "24px 28px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {renderMessageBlocks(message.content)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                          <button onClick={() => copyResponse(message.content)} style={shellButton}>Copy</button>
                          <button onClick={() => shareResponse(message.content)} style={shellButton}>Share</button>
                          <button onClick={() => sendQuery(FOLLOW_UPS.more)} disabled={loading} style={{ ...shellButton, opacity: loading ? 0.45 : 1 }}>Tell Me More</button>
                          <button onClick={() => sendQuery(FOLLOW_UPS.data)} disabled={loading} style={{ ...shellButton, opacity: loading ? 0.45 : 1 }}>Show Data</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--card)", border: "1px solid var(--lime)", overflow: "hidden" }}>
                    <img src="/mantle-logo.png" alt="Mantle Scout logo" style={logoImageStyle} />
                  </div>
                  <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderTop: "2px solid var(--lime)", padding: "20px 28px", display: "flex", gap: "6px", alignItems: "center" }}>
                    {[0, 1, 2].map((dot) => (
                      <div key={dot} style={{ width: "6px", height: "6px", background: "var(--lime)", borderRadius: "50%", animation: `pulse 1.2s ease-in-out ${dot * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}

              {error && <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", padding: "14px 18px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--danger-text)" }}>Error: {error}</div>}
              <div ref={bottomRef} />
            </div>
          )}

          <div style={{ position: messages.length > 0 ? "sticky" : "static", bottom: 0, background: "var(--bg)", borderTop: messages.length > 0 ? "1px solid var(--line)" : "none", paddingTop: messages.length > 0 ? "16px" : "0", paddingBottom: messages.length > 0 ? "24px" : "8px", marginTop: messages.length === 0 ? "auto" : "0" }}>
            <div style={{ border: "1px solid var(--line)", background: "var(--card)", borderRadius: "18px", padding: isMobile ? "8px" : "10px", overflow: "hidden" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendQuery(input)}
                placeholder="Ask about any Mantle protocol, token, or trend"
                style={{ width: "100%", minHeight: isMobile ? "50px" : "58px", background: "transparent", border: "none", outline: "none", padding: isMobile ? "12px 12px 14px" : "14px 14px 18px", color: "var(--text)", fontSize: isMobile ? "14px" : "15px", fontFamily: "var(--font-sans)" }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--muted-2)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Mantle Scout</span>
                <button
                  onClick={() => sendQuery(input)}
                  disabled={loading || !input.trim()}
                  style={{ background: loading || !input.trim() ? "var(--line)" : "var(--lime)", border: "none", borderRadius: "999px", padding: isMobile ? "9px 14px" : "10px 16px", cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: loading || !input.trim() ? "var(--muted)" : "#080C0A", letterSpacing: "1.5px", textTransform: "uppercase", transition: "all 0.15s" }}
                >
                  {loading ? "..." : "Research"}
                </button>
              </div>
            </div>
            {messages.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? "6px" : "8px", flexWrap: "wrap", marginTop: isMobile ? "10px" : "14px", paddingBottom: "2px" }}>
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendQuery(action.query)}
                    disabled={loading}
                    style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: "999px", color: "var(--muted)", cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-mono)", fontSize: isMobile ? "9px" : "10px", letterSpacing: "1px", padding: isMobile ? "7px 10px" : "8px 12px", textTransform: "uppercase", transition: "all 0.15s" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--lime)";
                      e.currentTarget.style.color = "var(--text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--line)";
                      e.currentTarget.style.color = "var(--muted)";
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
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
