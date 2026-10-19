import { Header } from "@/components/Header";
import { ExplorerControls } from "@/components/ExplorerControls";
import { ExplorerStage } from "@/components/ExplorerStage";
import { LocationMap } from "@/components/LocationMap";
import { Reveal } from "@/components/Reveal";
import { Extras } from "@/components/Extras";
import { AMENITIES, COLLECTIONS } from "@/lib/tower";
import { AUTHOR, PORTFOLIO_URL, SITE_URL } from "@/lib/site";

// Structured data. The brand is fictional, so no real-estate Offer schema.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Horizon Tower",
      url: SITE_URL,
      description:
        "Explore Horizon Tower, a fictional 72-level residence in Dubai, in real-time 3D: choose a level and a home, and move the sun across the sky.",
      inLanguage: "en",
      creator: { "@type": "Person", name: AUTHOR, url: PORTFOLIO_URL },
    },
    {
      "@type": "CreativeWork",
      "@id": `${SITE_URL}/#work`,
      name: "Horizon Tower — a procedural 3D tower explorer",
      url: SITE_URL,
      isFamilyFriendly: true,
      keywords: "3D website, WebGL, React Three Fiber, procedural architecture, concept project",
      copyrightYear: 2026,
      copyrightHolder: { "@type": "Person", name: AUTHOR, url: PORTFOLIO_URL },
      creator: { "@type": "Person", name: AUTHOR, url: PORTFOLIO_URL },
    },
  ],
};

const FIGURES = [
  { value: "288", unit: "m", label: "Height to the spire" },
  { value: "72", unit: "", label: "Levels above the podium" },
  { value: "90", unit: "°", label: "Total turn, base to crown" },
  { value: "214", unit: "", label: "Residences" },
];

const DRIVES = [
  { place: "Downtown", time: "10 min" },
  { place: "Business district", time: "12 min" },
  { place: "International airport", time: "14 min" },
  { place: "Marina & beaches", time: "24 min" },
  { place: "Desert conservation reserve", time: "35 min" },
];

const CONTACT = [
  { href: "mailto:kyan775909@gmail.com?subject=Horizon%20Tower%20viewing", label: "Email the studio", primary: true },
  { href: "https://wa.me/79193999749", label: "WhatsApp", primary: false },
  { href: "https://t.me/hassan_9400", label: "Telegram", primary: false },
];

export default function Home() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        {/* 1 · Hero + explorer */}
        <section id="explore" className="hero" aria-labelledby="hero-title">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Lumen Quay, Dubai — Completion Q4 2029</p>
              <h1 id="hero-title" className="display">
                Seventy-two levels. <em>One turning horizon.</em>
              </h1>
              <p className="lede">
                Horizon Tower turns a quarter circle on its way to the sky, so every residence faces its own view. Choose a
                level, choose a home, and move the sun to see how the light arrives.
              </p>
              <ExplorerControls />
            </div>
            <div className="hero-stage">
              <ExplorerStage />
            </div>
          </div>
        </section>

        {/* 2 · The tower */}
        <section id="tower" className="section" aria-labelledby="tower-title">
          <div className="wrap split reveal">
            <div>
              <p className="eyebrow">The Tower</p>
              <h2 id="tower-title" className="h2">
                A quarter turn, floor by floor.
              </h2>
            </div>
            <div className="prose">
              <p>
                Each floor plate rotates 1.25° from the one beneath it. Over 72 levels the tower completes a 90° turn — enough
                to give the upper residences a corner view of the Gulf, and to let the facade shade itself through the hottest
                hours.
              </p>
              <p>
                Vertical fins in brushed champagne aluminium are angled to the sun path: closed to the south at noon, open to
                the west at dusk.
              </p>
            </div>
          </div>
          <ul className="wrap figures reveal" aria-label="Key figures">
            {FIGURES.map((f) => (
              <li key={f.label} className="figure">
                <span className="figure-value">
                  {f.value}
                  {f.unit && <span className="figure-unit">{f.unit}</span>}
                </span>
                <span className="figure-label">{f.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3 · Residences (light section) */}
        <section id="residences" className="section section--light" aria-labelledby="res-title">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">Residences</p>
              <h2 id="res-title" className="h2">
                Four collections, one address.
              </h2>
            </div>
            <ol className="collections reveal">
              {COLLECTIONS.map((c, i) => (
                <li key={c.id} className="collection">
                  <span className="collection-index" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <h3 className="h3">{c.name}</h3>
                  <p className="collection-levels">
                    Levels {c.from}–{c.to}
                  </p>
                  <p className="collection-blurb">{c.blurb}</p>
                  <dl className="collection-facts">
                    <div>
                      <dt>Interiors</dt>
                      <dd>{c.sizes}</dd>
                    </div>
                    <div>
                      <dt>Price</dt>
                      <dd>{c.price}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
            <p className="fine reveal">Indicative figures for a fictional concept project.</p>
          </div>
        </section>

        {/* 4 · Amenities */}
        <section id="amenities" className="section" aria-labelledby="amen-title">
          <div className="wrap split reveal">
            <div>
              <p className="eyebrow">Sky Amenities</p>
              <h2 id="amen-title" className="h2">
                Shared levels, placed where the views are best.
              </h2>
            </div>
            <ol className="levels">
              {[...AMENITIES]
                .filter((a) => a.floor !== 2)
                .reverse()
                .map((a) => (
                  <li key={a.floor} className="level">
                    <span className="level-tag">L{String(a.floor).padStart(2, "0")}</span>
                    <div>
                      <h3 className="h3">{a.name}</h3>
                      <p>{a.text}</p>
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        </section>

        {/* 5 · Location */}
        <section id="location" className="section section--deep" aria-labelledby="loc-title">
          <div className="wrap split split--map reveal">
            <div>
              <p className="eyebrow">Location</p>
              <h2 id="loc-title" className="h2">
                On the water, ten minutes from everything.
              </h2>
              <p className="prose-p">
                Lumen Quay sits on a calm stretch of the creek, with a waterfront promenade, a marina for day boats and a direct
                road to the city&apos;s main arteries.
              </p>
              <dl className="drives">
                {DRIVES.map((d) => (
                  <div key={d.place}>
                    <dt>{d.place}</dt>
                    <dd>{d.time}</dd>
                  </div>
                ))}
              </dl>
              <p className="fine fine--dark">Indicative drive times outside peak hours.</p>
              <p className="fine fine--dark">
                The ground around the 3D tower is the real Dubai coastline, Palm Jumeirah included, from Landsat satellite
                data drawn at half scale. The tower and the quay are imagined. Imagery: NASA.
              </p>
            </div>
            <LocationMap />
          </div>
        </section>

        {/* 6 · Enquire */}
        <section id="enquire" className="section enquire" aria-labelledby="enq-title">
          <div className="wrap enquire-inner reveal">
            <p className="eyebrow">Private Viewings</p>
            <h2 id="enq-title" className="h2 h2--xl">
              See the light for yourself.
            </h2>
            <p className="lede lede--center">
              Viewings of the sales gallery and the full-scale show residence are by appointment.
            </p>
            <div className="actions">
              {CONTACT.map((c) => (
                <a
                  key={c.href}
                  href={c.href}
                  className={c.primary ? "btn btn--gold" : "btn btn--line"}
                  {...(c.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {c.label}
                </a>
              ))}
            </div>
            <p className="credit">
              Concept, design and 3D development by Alhassan Alfarran ·{" "}
              <a href={process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? "https://alhassan-portfolio-sigma.vercel.app"} target="_blank" rel="noopener noreferrer">
                Portfolio
              </a>{" "}
              ·{" "}
              <a href="https://github.com/kyan9400" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-row">
          <p>© 2026 Alhassan Alfarran</p>
          <p>Concept project — fictional brand.</p>
          <p className="footer-note">Horizon Tower, Lumen Quay and all figures are fictional.</p>
        </div>
      </footer>
      <Reveal />
      <Extras />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
