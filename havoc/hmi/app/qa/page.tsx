"use client";

import { useCallback, useState } from "react";
import { useHavoc } from "../context/HavocContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

interface Message {
  role: "user" | "assistant";
  text: string;
  time: string;
}

export default function QAPage() {
  const { handleQA } = useHavoc();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setLoading(true);
    const now = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setMessages((prev) => [...prev, { role: "user", text: q, time: now }]);
    try {
      const result = await handleQA(q);
      const ansTime = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setMessages((prev) => [...prev, { role: "assistant", text: result, time: ansTime }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Error", time: now }]);
    }
    setLoading(false);
  }, [question, loading, handleQA]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 lg:p-8 w-full" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-1">Questions</h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          Ask about decisions, documents, or policies.
        </p>

        <Card className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto mb-4 min-h-[200px]">
            {messages.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  e.g. &quot;Why was part #0001 rejected?&quot;
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className="p-3 border"
                    style={{
                      borderColor: m.role === "user" ? "var(--color-accent-blue)" : "var(--color-border)",
                      background: "var(--color-surface)",
                      borderLeftWidth: m.role === "user" ? 4 : 1,
                    }}
                  >
                    <div className="text-[10px] mb-1" style={{ color: "var(--color-text-muted)" }}>{m.time}</div>
                    <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                  </div>
                ))}
                {loading && (
                  <div className="p-3 border" style={{ borderColor: "var(--color-border)" }}>
                    <span className="animate-pulse text-sm" style={{ color: "var(--color-text-muted)" }}>Thinking…</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Enter question…"
              className="flex-1 bg-transparent text-sm py-2 px-3 border outline-none"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
            <Button onClick={handleAsk} disabled={loading || !question.trim()}>
              Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
