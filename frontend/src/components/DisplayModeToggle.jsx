import { DISPLAY_MODE } from '../utils/formatters.js';

export default function DisplayModeToggle({ mode, toggleMode }) {
  const isHumanMode = mode === DISPLAY_MODE.HUMAN;

  return (
    <button
      type="button"
      className={`display-mode-toggle${isHumanMode ? ' is-human' : ''}`}
      onClick={toggleMode}
      aria-label={`Switch to ${isHumanMode ? 'Nerd' : 'Human'} Mode`}
    >
      <span className="display-mode-toggle__track" />
      <span className={`display-mode-toggle__option${!isHumanMode ? ' is-active' : ''}`}>🔭 Nerd</span>
      <span className={`display-mode-toggle__option${isHumanMode ? ' is-active' : ''}`}>🌍 Human</span>
      <span className={`display-mode-toggle__thumb${isHumanMode ? ' is-human' : ''}`} />
    </button>
  );
}
