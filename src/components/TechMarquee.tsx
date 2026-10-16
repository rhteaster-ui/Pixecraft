export const PIXCRAFT_TECH = [
  {
    name: "React",
    icon: "https://cdn.simpleicons.org/react",
  },
  {
    name: "TypeScript",
    icon: "https://cdn.simpleicons.org/typescript",
  },
  {
    name: "Vite",
    icon: "https://cdn.simpleicons.org/vite",
  },
  {
    name: "Node.js",
    icon: "https://cdn.simpleicons.org/nodedotjs",
  },
  {
    name: "Vercel",
    icon: "https://cdn.simpleicons.org/vercel/ffffff",
  },
  {
    name: "GitHub",
    icon: "https://cdn.simpleicons.org/github/ffffff",
  },
  {
    name: "Sharp",
    icon: "https://cdn.simpleicons.org/sharp",
  },
];

export function TechMarquee() {
  const items = [...PIXCRAFT_TECH, ...PIXCRAFT_TECH];

  return (
    <section className="pc-tech scroll-reveal" aria-label="Pixcraft technology stack">
      <div className="pc-tech__meta">
        <span>BUILT WITH</span>
        <span className="pc-tech__line" />
        <span className="pc-tech__status">
          <i /> PIXCRAFT SYSTEM
        </span>
      </div>

      <div className="pc-tech__viewport">
        <div className="pc-tech__track">
          {items.map((tech, index) => (
            <div
              className="pc-tech__item"
              key={`${tech.name}-${index}`}
              aria-hidden={index >= PIXCRAFT_TECH.length}
            >
              <img
                src={tech.icon}
                alt=""
                loading="lazy"
                draggable={false}
                width={25}
                height={25}
              />
              <span>{tech.name}</span>
              <b>↗</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TechMarquee;
