// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRISIS CONSOLE UNCAUGHT ERROR:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0D0B0A] text-[#F5EFE8] flex items-center justify-center p-6 font-mono selection:bg-[#8B5E3C] selection:text-white">
          <div className="max-w-xl w-full bg-[#17120F] border border-[#DC2626]/50 rounded-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-[#33281F] pb-4">
              <div className="w-10 h-10 rounded bg-[#DC2626]/20 border border-[#DC2626] flex items-center justify-center text-[#DC2626]">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-[#F5EFE8] uppercase">
                  Console Recovery Engine
                </h1>
                <p className="text-[11px] text-[#A89684]">
                  Operational UI encountered an unhandled state exception
                </p>
              </div>
            </div>

            <div className="bg-[#211A15] border border-[#33281F] rounded p-3 text-xs space-y-2 overflow-x-auto">
              <div className="flex items-center gap-2 text-[#F87171] font-bold">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown runtime error'}</span>
              </div>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[10px] text-[#A89684] overflow-x-auto whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2 px-4 rounded bg-[#8B5E3C] hover:bg-[#B07A4F] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RELOAD OPERATIONAL CONSOLE</span>
              </button>
              <button
                onClick={this.handleHardReset}
                className="py-2 px-4 rounded bg-[#211A15] hover:bg-[#33281F] border border-[#33281F] text-[#A89684] hover:text-[#F5EFE8] text-xs transition-colors"
                title="Clears cached session tokens and localStorage"
              >
                RESET CACHE
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
