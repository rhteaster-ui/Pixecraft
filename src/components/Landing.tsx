import { useEffect, useState, useRef } from 'react';
import { ArrowUpRight, ArrowRight, Upload, ImagePlus, Check, MoveHorizontal, Layers, ShieldCheck } from 'lucide-react';
import { groups, icons, recipes, brand } from '../studio/registry';
import { toolInfo, type Lang } from '../i18n';
import { type Tool, defaults } from '../types';
import { localProcess, bytes } from '../engine';
import { TechMarquee } from './TechMarquee';
import '../landing-animations.css';
export function CraftMark() { return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 30V8h22M18 40h22V18" stroke="currentColor" strokeWidth="4"/><path d="M18 30V18h12v12H18Z" stroke="currentColor" strokeWidth="3"/><path d="m29 8 11 10M8 30l10 10" stroke="currentColor" strokeWidth="2"/></svg>; }
function ProcessDrawing({ kind }: {
    kind: number;
}) { return <svg className="process-drawing" viewBox="0 0 360 145" fill="none" aria-hidden="true">{kind === 0 ? <><rect x="22" y="25" width="120" height="94" rx="6" stroke="currentColor"/><path d="m30 102 30-34 25 19 23-37 26 52" stroke="currentColor"/><circle cx="52" cy="49" r="7" stroke="currentColor"/><path d="M163 72h31m-7-7 7 7-7 7" stroke="currentColor"/><rect x="218" y="25" width="120" height="94" rx="6" stroke="currentColor"/><path d="m230 102 24-32 23 18 26-42 23 56" stroke="var(--accent)" strokeWidth="3"/><path d="M210 35V17h18m102 0h16v18M210 110v18h18m102 0h16v-18" stroke="var(--accent)"/></> : kind === 1 ? <><rect x="28" y="28" width="84" height="94" rx="5" stroke="currentColor"/><rect x="138" y="47" width="84" height="75" rx="5" stroke="currentColor"/><rect x="248" y="73" width="84" height="49" rx="5" stroke="var(--accent)" strokeWidth="2"/><path d="M26 14h309M112 13l21 27m90 9 18 21" stroke="var(--accent)" strokeDasharray="4 4"/><path d="m271 97 10 10 25-24" stroke="var(--accent)" strokeWidth="3"/></> : <><rect x="22" y="30" width="88" height="88" rx="5" stroke="currentColor"/><rect x="139" y="15" width="68" height="103" rx="5" stroke="currentColor"/><rect x="235" y="57" width="103" height="61" rx="5" stroke="var(--accent)" strokeWidth="2"/><path d="m42 77 16-20 14 14 19-26M151 86l14-19 11 9 16-25m55 49 22-22 18 13 29-23" stroke="currentColor"/></>}</svg>; }
export default function Landing({ lang, upload, choose, sample, preset, about, composer }: {
    lang: Lang;
    upload: () => void;
    choose: (t: Tool) => void;
    sample: () => void;
    preset: (id: string) => void;
    about: () => void;
    composer: () => void;
}) {
    const id = lang === 'id', idx = id ? 0 : 1;
    const [split, setSplit] = useState(52), [tab, setTab] = useState<'adjust' | 'compress'>('adjust'), [result, setResult] = useState(''), [size, setSize] = useState(''), [originalSize, setOriginalSize] = useState(''), [group, setGroup] = useState('size');
    const containerRef = useRef<HTMLElement>(null);
    useEffect(() => { let alive = true, url = ''; fetch('/media/architecture.webp').then(r => r.blob()).then(async (b) => { const o = { ...defaults(1536, 1024), brightness: 116, saturation: 75, contrast: 108, quality: 68, format: 'webp' as const }; const out = await localProcess(b, tab, o); if (alive) {
        url = URL.createObjectURL(out);
        setResult(url);
        setSize(bytes(out.size));
        setOriginalSize(bytes(b.size));
    } }).catch(() => { }); return () => { alive = false; if (url)
        URL.revokeObjectURL(url); }; }, [tab]);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const root = containerRef.current;
        if (!root) return;
        if (!('IntersectionObserver' in window)) {
            root.querySelectorAll('.scroll-reveal, .tool-explorer, .workflow-showcase, .closing, .site-footer').forEach(el => el.classList.add('in-view'));
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
        const elements = root.querySelectorAll('.scroll-reveal, .tool-explorer, .workflow-showcase, .closing, .site-footer');
        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);
    return <main className="landing" ref={containerRef}>
  <section className="hero-v2"><div className="ambient-trace" aria-hidden="true"/>
   <div className="hero-text"><div className="overline hero-anim-overline"><span className="status-dot"/> YOUR EVERYDAY IMAGE STUDIO</div><h1 className="hero-anim-h1">{id ? 'Gambar bagus.' : 'Good images.'}<br /><em>{id ? 'Siap ke mana saja.' : 'Ready for more.'}</em></h1><p className="hero-anim-p">{id ? 'Dari satu foto sampai satu koleksi. Rapikan, optimalkan, dan siapkan gambar untuk langkah berikutnya.' : 'From a single photo to a whole collection. Refine, optimize, and prepare every image for what comes next.'}</p><div className="hero-buttons hero-anim-buttons"><button className="primary" onClick={upload}><Upload size={18}/>{id ? 'Masuk Studio' : 'Open Studio'}<ArrowUpRight size={18}/></button><button className="sample-link" onClick={sample}>{id ? 'Coba contoh' : 'Try a sample'}<ArrowRight size={16}/></button></div><small className="hero-anim-small">JPG, PNG, WebP · {id ? 'Pilih hingga 12 gambar' : 'Select up to 12 images'}</small><div className="hero-proof hero-anim-proof"><span><Check size={14}/>{id ? 'Alat lokal tanpa akun' : 'Local tools, no account'}</span><span><Layers size={14}/>{id ? 'Satu ruang kerja' : 'One workspace'}</span></div></div>
   <div className="hero-demo hero-anim-demo"><div className="demo-header"><span><CraftMark /> STUDIO / 001</span><div className="demo-tabs">{(['adjust', 'compress'] as const).map(v => <button className={tab === v ? 'active' : ''} key={v} onClick={() => setTab(v)}>{v === 'adjust' ? (id ? 'Warna' : 'Color') : (id ? 'Kompres' : 'Compress')}</button>)}</div></div><div className="demo-photo"><img src={result || '/media/architecture.webp'} alt={id ? 'Contoh gambar setelah pengolahan lokal' : 'Locally processed sample'} width="1536" height="1024"/><img className="demo-before" src="/media/architecture.webp" alt="" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}/><div className="demo-split" style={{ left: `${split}%` }}><MoveHorizontal size={18}/></div><input type="range" aria-label={id ? 'Bandingkan contoh' : 'Compare sample'} min="0" max="100" value={split} onChange={e => setSplit(Number(e.target.value))}/><span className="photo-tag before">{id ? 'Sebelum' : 'Before'}</span><span className="photo-tag after">{id ? 'Sesudah' : 'After'}</span></div><div className="demo-footer"><div><span>{id ? 'PRATINJAU LANGSUNG' : 'LIVE PREVIEW'}</span><strong>{tab === 'adjust' ? (id ? 'Warna, dengan karakter.' : 'Color, with character.') : (id ? 'Lebih ringan. Tetap tajam.' : 'Less weight. More detail.')}</strong></div><span className="demo-size">{tab === 'compress' ? `${originalSize} → ${size}` : '116 / 108 / 75'}<small>{tab === 'compress' ? 'WebP' : 'Brightness / Contrast / Saturation'}</small></span></div><div className="demo-under"><span>01 — THE ARCHITECTURE OF AN IMAGE</span><span>PIXCRAFT ORIGINAL</span></div></div>
  </section>
  <section className="tool-explorer scroll-reveal" id="tools"><div className="section-head scroll-reveal-child"><div><span className="overline">01 / YOUR TOOLKIT</span><h2>{id ? 'Sedikit langkah. Banyak kemungkinan.' : 'A few steps. More possibilities.'}</h2></div><p>{id ? 'Pilih alat, lalu buka gambar dari perangkatmu.' : 'Choose a tool, then open an image from your device.'}</p></div><div className="group-tabs scroll-reveal-child">{groups.map(g => <button key={g.id} className={group === g.id ? 'active' : ''} onClick={() => setGroup(g.id)}><g.icon size={18}/>{g.name[idx]}</button>)}</div><div className="tool-rows">{groups.find(g => g.id === group)!.tools.map((t, n) => { const Icon = icons[t]; return <button key={t} className="tool-row" style={{ '--i': n } as React.CSSProperties} onClick={() => choose(t)}><span className="row-number">0{n + 1}</span><Icon size={24}/><div><strong>{toolInfo[t].name[idx]}</strong><p>{toolInfo[t].description[idx]}</p></div><span className="tool-kind">{['upscale', 'removebg', 'removewm', 'removeobj', 'expand'].includes(t) ? 'AI' : id ? 'LOKAL' : 'LOCAL'}</span><ArrowUpRight size={22}/></button>; })}</div></section>
  <TechMarquee />
  <section className="composer-demo-band scroll-reveal"><div><span className="overline">02 / COMPOSE WITH INTENT</span><h2>{id ? 'Beberapa sudut. Satu cerita.' : 'Multiple views. One story.'}</h2><p>{id ? 'Susun 2–5 gambar, geser pembatas, lalu atur isi setiap frame. Dimensi kanvas dan hasil ekspor tetap dalam kendalimu.' : 'Arrange 2–5 images, move the dividers, and refine each frame. Canvas dimensions and export stay in your control.'}</p><button className="secondary" onClick={composer}>{id ? 'Buka Composer' : 'Open Composer'}<ArrowUpRight size={16}/></button></div><div className="composition-demo" aria-label={id ? 'Demonstrasi susunan empat frame' : 'Four-frame layout demonstration'}>{[0,1,2,3].map(i => <img key={i} src="/media/architecture-mobile.webp" width={480} height={320} alt="" loading="lazy"/>)}</div></section>
  <section className="workflow-showcase scroll-reveal" id="workflow"><div className="section-head scroll-reveal-child"><div><span className="overline">02 / LESS REPETITION</span><h2>{id ? 'Pekerjaan berulang,\nselesai dalam satu resep.' : 'Repeat the result.\nSkip the repetition.'}</h2></div><p>{id ? 'Simpan urutan prosesmu. Jalankan kembali pada gambar terpilih, lalu periksa setiap hasil sebelum ekspor.' : 'Save a sequence of edits. Run it on selected images and review every result before export.'}</p></div><div className="recipe-showcase">{recipes.map((r, n) => <button key={r.id} style={{ '--i': n } as React.CSSProperties} onClick={() => preset(r.id)}><div className="recipe-number">0{n + 1}<ArrowUpRight size={20}/></div><ProcessDrawing kind={n}/><h3>{r.name}</h3><p>{r.description}</p><span>{id ? 'Buka resep' : 'Open recipe'}<ArrowRight size={16}/></span></button>)}</div></section>
  <section className="closing scroll-reveal"><div className="scroll-reveal-child"><span className="overline">BUILT AROUND YOUR IMAGES</span><h2>{id ? 'Punya gambar?\nMari mulai.' : 'Have an image?\nMake it ready.'}</h2><button className="primary" onClick={upload}><ImagePlus size={18}/>{id ? 'Buka ruang kerja' : 'Open the studio'}<ArrowUpRight size={18}/></button></div><div className="closing-notes scroll-reveal-child"><div><ShieldCheck size={22}/><h3>{id ? 'Proses lokal, tetap di perangkat.' : 'Local edits stay on your device.'}</h3><p>{id ? 'Kompres, crop, resize, dan alat lokal tidak mengunggah gambar. HD dan Hapus BG mengirim gambar ke penyedia AI saat kamu menjalankannya.' : 'Compression, crop, resize and local tools do not upload images. HD and background removal send images to the AI provider when you run them.'}</p></div><details><summary>{id ? 'Bisakah saya memilih banyak gambar?' : 'Can I work with multiple images?'}</summary><p>{id ? 'Ya. Tambahkan hingga 12 gambar, pilih yang ingin diproses, lalu unduh satu hasil atau kumpulkan hasil dalam ZIP.' : 'Yes. Add up to 12 images, select the ones to process, then download a single result or a ZIP.'}</p></details><details><summary>{id ? 'Apakah file asli tetap tersimpan?' : 'Is the original preserved?'}</summary><p>{id ? 'Gambar asli tetap tersedia dalam riwayat tiap gambar selama sesi. Gunakan Simpan untuk membuka kembali proyek dari perangkat yang sama.' : 'The original stays in each image’s history during the session. Use Save to reopen the project on the same device.'}</p></details></div></section>
  <footer className="site-footer scroll-reveal"><div className="wordmark"><CraftMark />{brand.name}<span>.</span></div><span>{id ? 'Dibuat untuk gambar. Dirancang untuk alurmu.' : 'Made for images. Designed for your flow.'}</span><button onClick={about}>About Pixcraft</button><small>© {new Date().getFullYear()} · Credit by <a href="https://rhmt.biz.id" target="_blank" rel="noopener noreferrer">{brand.credit}</a></small></footer>
 </main>;
}
