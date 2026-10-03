import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing UI root');
createRoot(root).render(<App />);
