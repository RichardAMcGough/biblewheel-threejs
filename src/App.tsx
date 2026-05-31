import { useState } from 'react';
import { BibleWheel } from './features/bible-wheel/BibleWheel';
import type { BibleWheelBook } from './features/bible-wheel/bible-wheel.types';
import { Github, Info } from 'lucide-react';

export default function App() {
  const [, setSelectedBook] = useState<BibleWheelBook | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Bible Wheel</h1>
          <span className="subtitle">Canon Wheel • React + Three.js</span>
        </div>
        <div className="header-right">
          <a 
            href="https://www.biblewheel.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="link"
          >
            <Info size={16} /> biblewheel.com
          </a>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="link"
          >
            <Github size={16} /> Source
          </a>
        </div>
      </header>

      <main className="main">
        <BibleWheel 
          onBookSelected={setSelectedBook}
          initialBookPosition={1}
        />
      </main>

      <footer className="app-footer">
        <p>
          Faithful React port of the Angular Bible Wheel. 
          Click books • Toggle ▣ for Canon blocks • ⚙ colors + export
        </p>
      </footer>
    </div>
  );
}
