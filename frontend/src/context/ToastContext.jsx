import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

let toastIdCounter = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);
    const confirmResolveRef = useRef(null);

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const toast = useCallback({
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error', 5000),
        info: (msg) => addToast(msg, 'info'),
        warning: (msg) => addToast(msg, 'warning', 4500),
    }, [addToast]);

    // Make toast callable directly: toast('msg') or toast.success('msg')
    const toastFn = useCallback((msg, type) => addToast(msg, type), [addToast]);
    toastFn.success = toast.success;
    toastFn.error = toast.error;
    toastFn.info = toast.info;
    toastFn.warning = toast.warning;

    const showConfirm = useCallback((message) => {
        return new Promise((resolve) => {
            confirmResolveRef.current = resolve;
            setConfirmState({ message });
        });
    }, []);

    const handleConfirmYes = () => {
        confirmResolveRef.current?.(true);
        setConfirmState(null);
    };

    const handleConfirmNo = () => {
        confirmResolveRef.current?.(false);
        setConfirmState(null);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ toast: toastFn, showConfirm }}>
            {children}

            {/* Toast Container */}
            <div style={{
                position: 'fixed',
                top: '1.5rem',
                right: '1.5rem',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                pointerEvents: 'none',
                maxWidth: '420px',
                width: '100%'
            }}>
                {toasts.map(t => (
                    <div
                        key={t.id}
                        onClick={() => removeToast(t.id)}
                        style={{
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            padding: '1rem 1.25rem',
                            borderRadius: '0.75rem',
                            color: '#fff',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            lineHeight: 1.4,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                            animation: 'toastSlideIn 0.35s ease-out',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            background:
                                t.type === 'success' ? 'linear-gradient(135deg, #2e7d32 0%, #43a047 100%)' :
                                t.type === 'error'   ? 'linear-gradient(135deg, #c62828 0%, #e53935 100%)' :
                                t.type === 'warning' ? 'linear-gradient(135deg, #e65100 0%, #f57c00 100%)' :
                                                       'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)',
                        }}
                    >
                        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>
                            {t.type === 'success' && '✓'}
                            {t.type === 'error' && '✕'}
                            {t.type === 'warning' && '!'}
                            {t.type === 'info' && 'i'}
                        </span>
                        <span style={{ flex: 1 }}>{t.message}</span>
                    </div>
                ))}
            </div>

            {/* Confirm Dialog */}
            {confirmState && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10001,
                    background: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'toastFadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: '1rem',
                        padding: '2rem',
                        maxWidth: '420px',
                        width: '90%',
                        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
                        animation: 'toastSlideIn 0.25s ease-out'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', color: '#1a1a1a' }}>Confirm</h3>
                        <p style={{ margin: '0 0 1.5rem 0', color: '#555', lineHeight: 1.5, fontSize: '0.95rem' }}>
                            {confirmState.message}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleConfirmNo}
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    border: '1px solid #ddd',
                                    background: '#fff',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.95rem',
                                    color: '#555'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmYes}
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                                    color: '#fff',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    fontSize: '0.95rem',
                                    fontWeight: 600
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Animations */}
            <style>{`
                @keyframes toastSlideIn {
                    from { opacity: 0; transform: translateX(40px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes toastFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
};
