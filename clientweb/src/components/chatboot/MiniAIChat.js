import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import {
  FaRobot,
  FaPaperPlane,
  FaTimes,
  FaCircle,
  FaTrash,
} from "react-icons/fa";
import "../style/miniAIChat.css";

const API_URL = "/api/ai/chat";

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Bonjour 👋 Je suis l'assistant IA Medica-Sign.\nComment puis-je vous aider aujourd'hui ?",
};

const MiniAIChat = ({ isOpen, setIsOpen, suggestions = [] }) => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  /* ── Auto-focus ── */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── Send message ── */
  const sendMessage = useCallback(
    async (customMessage = null) => {
      const messageToSend = customMessage || input;
      if (!messageToSend.trim() || loading) return;

      const userMessage = { role: "user", content: messageToSend };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      try {
        const { data } = await axios.post(
          API_URL,
          { message: messageToSend },
          { withCredentials: true },
        );

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data?.reply || "Je suis là pour vous aider.",
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "⚠️ Une erreur est survenue. Veuillez réessayer.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading],
  );

  /* ── Clear chat ── */
  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
  };

  /* ── Format message content ── */
  const formatContent = (text) => {
    return text.split("\n").map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    ));
  };

  /* ── Time helper ── */
  const getTimeStr = () => {
    const now = new Date();
    return now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="ai-wrapper">
      {/* ── Floating button ── */}
      {!isOpen && (
        <button
          className="ai-btn"
          onClick={() => setIsOpen(true)}
          title="Assistant IA"
        >
          <FaRobot />
        </button>
      )}

      {/* ── Chat box ── */}
      {isOpen && (
        <div className="ai-box">
          {/* Header */}
          <div className="ai-header">
            <div className="ai-header-left">
              <FaRobot />
              <span>Medica-Sign AI</span>
            </div>

            <div className="ai-header-right">
              <div className="ai-status">
                <FaCircle className="status-dot" />
                <span>En ligne</span>
              </div>

              {messages.length > 1 && (
                <button
                  className="ai-close"
                  onClick={clearChat}
                  title="Effacer la conversation"
                >
                  <FaTrash style={{ fontSize: 10 }} />
                </button>
              )}

              <button
                className="ai-close"
                onClick={() => setIsOpen(false)}
                title="Fermer"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && suggestions.length > 0 && (
            <div className="ai-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="ai-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`ai-msg ${msg.role}`}>
                {formatContent(msg.content)}
              </div>
            ))}

            {loading && (
              <div className="ai-msg assistant typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="ai-input">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              title="Envoyer"
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiniAIChat;
