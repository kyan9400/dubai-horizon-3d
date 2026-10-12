import { MobileMenu } from "./MobileMenu";
import { MotionToggle } from "./MotionToggle";
import { SECTIONS } from "@/lib/site";

// header nav = every section except the enquiry, which has its own CTA
const NAV = SECTIONS.filter((s) => s.id !== "enquire").map((s) => ({ href: `#${s.id}`, label: s.label }));

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a href="#explore" className="brand" aria-label="Horizon Tower, back to top">
          <svg viewBox="0 0 24 32" width="18" height="24" aria-hidden="true">
            <path d="M7 31 L9 4 L15 1 L17 31 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9 12 H16 M8.6 20 H16.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span>Horizon</span>
        </a>
        <nav aria-label="Sections" className="nav-desktop">
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href}>{n.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="header-actions">
          <MotionToggle />
          <a href="#enquire" className="btn btn--gold btn--sm">
            <span className="cta-long">Private viewings</span>
            <span className="cta-short">Viewings</span>
          </a>
          <MobileMenu items={NAV} cta={{ href: "#enquire", label: "Private viewings" }} />
        </div>
      </div>
      {/* scroll progress: CSS scroll timeline only, no JS */}
      <div className="scroll-progress" aria-hidden="true" />
    </header>
  );
}
