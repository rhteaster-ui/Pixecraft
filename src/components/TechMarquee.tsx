
import React, { useState } from 'react';

export interface TechItem {
  name: string;
  category?: string;
  iconUrl: string;
  fallbackUrl?: string;
}

const CDN = 'https://cdn.simpleicons.org';
const JSDELIVR =
  'https://cdn.jsdelivr.net/npm/simple-icons@16/icons';

export const PIXCRAFT_TECH: TechItem[] = [
  {
    name: 'React 19',
    category: 'UI Engine',
    iconUrl: `${CDN}/react/61DAFB`,
    fallbackUrl: `${JSDELIVR}/react.svg`,
  },
  {
    name: 'TypeScript',
    category: 'Strict Typing',
    iconUrl: `${CDN}/typescript/3178C6`,
    fallbackUrl: `${JSDELIVR}/typescript.svg`,
  },
  {
    name: 'Vite 8',
    category: 'Ultra-fast Bundler',
    iconUrl: `${CDN}/vite/646CFF`,
    fallbackUrl: `${JSDELIVR}/vite.svg`,
  },
  {
    name: 'Node.js',
    category: 'Runtime',
    iconUrl: `${CDN}/nodedotjs/5FA04E`,
    fallbackUrl: `${JSDELIVR}/nodedotjs.svg`,
  },
  {
    name: 'Vercel',
    category: 'Edge & Serverless',
    iconUrl: `${CDN}/vercel/000000/FFFFFF`,
    fallbackUrl: `${JSDELIVR}/vercel.svg`,
  },
  {
    name: 'GitHub',
    category: 'Open Source',
    iconUrl: `${CDN}/github/181717/FFFFFF`,
    fallbackUrl: `${JSDELIVR}/github.svg`,
  },
  {
    name: 'Sharp',
    category: 'High-speed Image Ops',
    iconUrl: `${CDN}/sharp/99CC00`,
    fallbackUrl: `${JSDELIVR}/sharp.svg`,
  },
  {
    name: 'WebAssembly',
    category: 'Client Compute',
    iconUrl: `${CDN}/webassembly/654FF0`,
    fallbackUrl: `${JSDELIVR}/webassembly.svg`,
  },
  {
    name: 'WebGL / Canvas',
    category: 'Hardware Acceleration',
    iconUrl: `${CDN}/webgl/990000`,
    fallbackUrl: `${JSDELIVR}/webgl.svg`,
  },
];

function TechIcon({
  tech,
}: {
  tech: TechItem;
}) {
  const [url, setUrl] = useState(tech.iconUrl);
  const [failed, setFailed] = useState(false);

  return (
    <div className="pc-tech__icon-box">
      {failed ? (
        <span
          aria-hidden="true"
          style={{
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {tech.name.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <img
          className="pc-tech__svg"
          src={url}
          alt=""
          width={24}
          height={24}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => {
            if (
              tech.fallbackUrl &&
              url !== tech.fallbackUrl
            ) {
              setUrl(tech.fallbackUrl);
            } else {
              setFailed(true);
            }
          }}
          style={{
            width: '24px',
            height: '24px',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}

function TechCard({
  tech,
  duplicate = false,
}: {
  tech: TechItem;
  duplicate?: boolean;
}) {
  return (
    <div
      className="pc-tech__item"
      aria-hidden={duplicate ? true : undefined}
    >
      <TechIcon tech={tech} />

      <div className="pc-tech__info">
        <span className="pc-tech__name">
          {tech.name}
        </span>

        {tech.category && (
          <small className="pc-tech__cat">
            {tech.category}
          </small>
        )}
      </div>

      <b
        className="pc-tech__arrow"
        aria-hidden="true"
      >
        ↗
      </b>
    </div>
  );
}

export function TechMarquee() {
  return (
    <section
      className="pc-tech scroll-reveal"
      aria-label="Pixcraft technology stack"
    >
      <div className="pc-tech__meta">
        <span>BUILT WITH</span>

        <span className="pc-tech__line" />

        <span className="pc-tech__status">
          <i /> PIXCRAFT ARCHITECTURE
        </span>
      </div>

      <div
        className="pc-tech__viewport"
        tabIndex={0}
        role="region"
        aria-label="Technology marquee"
      >
        <div className="pc-tech__track">
          {PIXCRAFT_TECH.map((tech, index) => (
            <TechCard
              key={`tech-a-${index}`}
              tech={tech}
            />
          ))}

          {PIXCRAFT_TECH.map((tech, index) => (
            <TechCard
              key={`tech-b-${index}`}
              tech={tech}
              duplicate
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default TechMarquee;
