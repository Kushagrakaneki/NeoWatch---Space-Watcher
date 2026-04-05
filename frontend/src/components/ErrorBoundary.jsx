import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('NeoWatch component error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '1.5px solid rgba(255,45,45,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,45,45,0.6)' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#ff2d2d', letterSpacing: '2px', marginBottom: '8px' }}>
            COMPONENT ERROR
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '320px', lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected error occurred in this component.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,45,45,0.3)',
              color: '#ff2d2d', fontFamily: 'var(--font-mono)', fontSize: '11px',
              letterSpacing: '1px',
            }}
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
