"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Copy, Paperclip, Sofa, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

// UI only: sending appends your message locally; no model is called.

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** Optional proposed scene change rendered as a card. */
  proposal?: { item: string; detail: string };
};

const INITIAL: Message[] = [
  {
    id: 1,
    role: "assistant",
    text: "Hi! I've loaded room_fused.ply (about 15 × 9 m). Ask me to suggest a layout, place furniture, or check clearances.",
  },
  { id: 2, role: "user", text: "Put a 3-seat sofa facing the window." },
  {
    id: 3,
    role: "assistant",
    text: "The window wall looks like the long east side. I'd place the sofa 2.4 m from it, centered, leaving a 90 cm walkway behind.",
    proposal: { item: "3-Seat Sofa", detail: "x 4.20 · z −1.10 · rot 90°" },
  },
];

const SUGGESTIONS = ["Suggest a layout", "Make it cozier", "Check walkway clearance"];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Scroll only the message list (scrollIntoView would also scroll the
    // overflow-hidden panel ancestors).
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: t }]);
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "";
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a newline. Ignore Enter while an IME
    // (e.g. Zhuyin / Pinyin) is composing, or confirming a candidate would send.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500 px-3 py-2 text-sm whitespace-pre-wrap text-white">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-200">{m.text}</p>
                {m.proposal && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Sofa className="size-4 text-indigo-400" aria-hidden />
                      <span className="text-sm font-medium text-zinc-100">{m.proposal.item}</span>
                    </div>
                    <p className="mb-3 font-mono text-[11px] text-zinc-500">{m.proposal.detail}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-md bg-indigo-500 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-400"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-md bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-1 text-zinc-600">
                  {[
                    { icon: Copy, label: "Copy" },
                    { icon: ThumbsUp, label: "Good response" },
                    { icon: ThumbsDown, label: "Bad response" },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      className="rounded p-1 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                    >
                      <Icon className="size-3.5" aria-hidden />
                      <span className="sr-only">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-zinc-800 px-3 pt-3 pb-2">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900 focus-within:border-indigo-500"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // Auto-grow up to the max-height set below.
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={onKeyDown}
            placeholder="Ask about layout, furniture…"
            className="block max-h-36 w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <button
              type="button"
              title="Attach image"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Paperclip className="size-4" aria-hidden />
              <span className="sr-only">Attach image</span>
            </button>
            <button
              type="submit"
              disabled={!draft.trim()}
              title="Send"
              className="flex size-7 items-center justify-center rounded-full bg-indigo-500 text-white transition-colors hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              <ArrowUp className="size-4" aria-hidden />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-zinc-600">
          Preview — not connected to a model yet.
        </p>
      </div>
    </div>
  );
}
