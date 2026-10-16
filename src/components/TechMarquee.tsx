import React from 'react';

export interface TechItem {
  name: string;
  category?: string;
  icon: React.ReactNode;
}

export const PIXCRAFT_TECH: TechItem[] = [
  {
    name: 'React 19',
    category: 'UI Engine',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="pc-tech__svg" aria-label="React">
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(0 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'TypeScript',
    category: 'Strict Typing',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="pc-tech__svg" aria-label="TypeScript">
        <path d="M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4.8 5.5v2h2.2V17h2.4v-6.5h2.2v-2H7.8zm9.1 4.2c.4.3.9.5 1.5.5.6 0 .9-.3.9-.7 0-.4-.3-.6-1.1-.9-1.3-.4-2-.9-2-2 0-1.1.9-2 2.2-2 .8 0 1.5.2 2 .6l-.5 1.6c-.4-.3-.8-.5-1.4-.5-.5 0-.8.2-.8.5 0 .3.2.5 1 .8 1.4.5 2.1 1 2.1 2.1 0 1.2-.9 2.1-2.4 2.1-.9 0-1.7-.3-2.3-.7l.5-1.8z" />
      </svg>
    ),
  },
  {
    name: 'Vite 8',
    category: 'Ultra-fast Bundler',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="pc-tech__svg" aria-label="Vite">
        <path d="M21.5 3.5l-9 16.5a.6.6 0 0 1-1 0L2.5 3.5a.6.6 0 0 1 .7-.9l8.6 2.4a.6.6 0 0 0 .4 0l8.6-2.4a.6.6 0 0 1 .7.9z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12.8 3L8 12.2h4.5L10 18l7.5-8.8H13l2-6.2h-2.2z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'Node.js',
    category: 'Runtime',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="pc-tech__svg" aria-label="Node.js">
        <path d="M12 2l9 5.2v10.4L12 23l-9-5.4V7.2L12 2zm0 2.5L4.8 8.6v6.8L12 19.5l7.2-4.1V8.6L12 4.5z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    ),
  },
  {
    name: 'Vercel',
    category: 'Edge & Serverless',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="pc-tech__svg" aria-label="Vercel">
        <path d="M12 2L24 22H0L12 2z" />
      </svg>
    ),
  },
  {
    name: 'GitHub',
    category: 'Open Source',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="pc-tech__svg" aria-label="GitHub">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    name: 'Sharp',
    category: 'High-speed Image Ops',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pc-tech__svg" aria-label="Sharp">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    name: 'WebAssembly',
    category: 'Client Compute',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="pc-tech__svg" aria-label="WebAssembly">
        <path d="M2.5 3h19A1.5 1.5 0 0 1 23 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 1 19.5v-15A1.5 1.5 0 0 1 2.5 3zm1.9 14.5h2.2l1.6-7.8 1.8 7.8h2l1.8-7.8 1.6 7.8h2.2l-2.4-11h-2.3l-1.9 8.2-1.9-8.2H6.8l-2.4 11z" />
      </svg>
    ),
  },
  {
    name: 'WebGL / Canvas',
    category: 'Hardware Acceleration',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pc-tech__svg" aria-label="WebGL">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
];

export function TechMarquee() {
  // Seamless loop: repeat list to ensure zero empty space on any viewport width
  const setA = PIXCRAFT_TECH;
  const setB = PIXCRAFT_TECH;

  return (
    <section className="pc-tech scroll-reveal" aria-label="Pixcraft technology stack">
      <div className="pc-tech__meta">
        <span>BUILT WITH</span>
        <span className="pc-tech__line" />
        <span className="pc-tech__status">
          <i /> PIXCRAFT ARCHITECTURE
        </span>
      </div>

      <div className="pc-tech__viewport" tabIndex={0} role="region" aria-label="Technology marquee">
        <div className="pc-tech__track">
          {setA.map((tech, index) => (
            <div className="pc-tech__item" key={`tech-a-${tech.name}-${index}`}>
              <div className="pc-tech__icon-box">
                {tech.icon}
              </div>
              <div className="pc-tech__info">
                <span className="pc-tech__name">{tech.name}</span>
                {tech.category && <small className="pc-tech__cat">{tech.category}</small>}
              </div>
              <b className="pc-tech__arrow" aria-hidden="true">↗</b>
            </div>
          ))}
          {setB.map((tech, index) => (
            <div className="pc-tech__item" key={`tech-b-${tech.name}-${index}`} aria-hidden="true">
              <div className="pc-tech__icon-box">
                {tech.icon}
              </div>
              <div className="pc-tech__info">
                <span className="pc-tech__name">{tech.name}</span>
                {tech.category && <small className="pc-tech__cat">{tech.category}</small>}
              </div>
              <b className="pc-tech__arrow" aria-hidden="true">↗</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TechMarquee;
