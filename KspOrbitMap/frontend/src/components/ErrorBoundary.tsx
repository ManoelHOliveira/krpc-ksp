import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "40px",
          background: "#1a0505",
          color: "#f44",
          fontFamily: "monospace",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          border: "5px solid #f44"
        }}>
          <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>[SYSTEM CRITICAL ERROR]</h1>
          <p style={{ maxWidth: "600px", textAlign: "center", marginBottom: "20px" }}>
            The UI encountered a fatal exception. The development server might be restarting or a new feature has a typo.
          </p>
          <div style={{ background: "#000", padding: "15px", borderRadius: "4px", border: "1px solid #444", fontSize: "12px" }}>
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: "30px", 
              padding: "10px 20px", 
              background: "#f44", 
              color: "#fff", 
              border: "none", 
              cursor: "pointer",
              fontWeight: "bold",
              fontFamily: "Orbitron"
            }}
          >
            RETRY INITIALIZATION
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
