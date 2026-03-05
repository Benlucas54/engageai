import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      onLogin();
    }
  };

  return (
    <div style={{ padding: "32px 24px", textAlign: "center" }}>
      <div
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "#1c1917",
          marginBottom: "4px",
        }}
      >
        EngageAI
      </div>
      <div style={{ fontSize: "12px", color: "#78746e", marginBottom: "24px" }}>
        Sign in to get started
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ ...inputStyle, marginTop: "8px" }}
        />

        {error && (
          <div
            style={{
              color: "#b91c1c",
              fontSize: "11px",
              marginTop: "8px",
              textAlign: "left",
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "7px",
  border: "1px solid #e9e6e0",
  fontSize: "12px",
  fontFamily: "inherit",
  color: "#1c1917",
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  marginTop: "16px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#1c1917",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
