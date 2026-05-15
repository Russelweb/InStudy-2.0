/**
 * AuraContext — global trigger system for the Aura mascot.
 *
 * Any component can call triggerAura() to make Aura react.
 *
 * Usage:
 *   import { useAura } from '../context/AuraContext';
 *   const { triggerAura } = useAura();
 *
 *   triggerAura('concerned', 'No documents yet.', { label: 'Go to Knowledge Base', onClick: fn });
 *   triggerAura('celebrating', 'Quiz done. 87% accuracy!');
 *   triggerAura('nudge', "You haven't studied in 4 days.");
 *   triggerAura('pointing', 'Start by creating a course.', { label: 'Create Course', onClick: fn });
 *   triggerAura('thinking'); // loading state — no message needed
 *   triggerAura('idle');     // reset to default
 *
 * States: 'idle' | 'pointing' | 'thinking' | 'celebrating' | 'concerned' | 'nudge' | 'guide'
 *
 * Contextual help on click:
 *   Pages call registerPageHelp(message, action) on mount.
 *   When the user clicks the idle orb, Aura shows that page's help message.
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const AuraContext = createContext(null);

export const AuraProvider = ({ children }) => {
  const [state, setState] = useState({
    mode:    'idle',
    message: null,
    action:  null,
    visible: false,
  });

  // Page-level contextual help — registered by each page on mount
  const pageHelpRef = useRef({ message: null, action: null });
  const dismissTimer = useRef(null);

  const triggerAura = useCallback((mode, message = null, action = null, duration = 7000) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setState({ mode, message, action, visible: !!message });
    if (message && mode !== 'thinking') {
      dismissTimer.current = setTimeout(() => {
        setState(prev => ({ ...prev, visible: false, mode: 'idle' }));
      }, duration);
    }
  }, []);

  const dismissAura = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setState({ mode: 'idle', message: null, action: null, visible: false });
  }, []);

  // Pages register their contextual help message here
  const registerPageHelp = useCallback((message, action = null) => {
    pageHelpRef.current = { message, action };
    // Returns a cleanup function
    return () => { pageHelpRef.current = { message: null, action: null }; };
  }, []);

  // Called by the orb when clicked while idle (no bubble showing)
  const handleOrbClick = useCallback(() => {
    const { message, action } = pageHelpRef.current;
    if (message) {
      triggerAura('guide', message, action, 8000);
    }
  }, [triggerAura]);

  return (
    <AuraContext.Provider value={{ auraState: state, triggerAura, dismissAura, registerPageHelp, handleOrbClick }}>
      {children}
    </AuraContext.Provider>
  );
};

export const useAura = () => {
  const ctx = useContext(AuraContext);
  if (!ctx) throw new Error('useAura must be used inside AuraProvider');
  return ctx;
};

/**
 * useAuraHelp — register contextual help for the current page.
 * When the user clicks the idle Aura orb, this message appears.
 *
 * Usage (in any page component):
 *   useAuraHelp(
 *     'Rate each card to update your mastery score automatically.',
 *     { label: 'View Mastery', onClick: () => navigate('/mastery') }
 *   );
 */
export const useAuraHelp = (message, action = null) => {
  const { registerPageHelp } = useAura();
  useEffect(() => {
    const cleanup = registerPageHelp(message, action);
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
