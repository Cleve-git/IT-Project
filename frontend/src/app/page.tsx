import Link from 'next/link';
import styles from './landing.module.css';

export default function RootIndexPage() {
  return (
    <div className={styles.landing}>
      {/* Top Navigation */}
      <nav className={styles.topNav}>
        <Link href="/" className={styles.topNavBrand}>
          Conda AI
        </Link>
        <div className={styles.topNavLinks}>
          <Link href="#pricing" className={styles.navLink}>Pricing</Link>
          <Link href="#features" className={styles.navLink}>Features</Link>
          <Link href="#enterprise" className={styles.navLink}>Enterprise</Link>
          <Link href="#blog" className={styles.navLink}>Blog</Link>
        </div>
        <div className={styles.topNavActions}>
          <Link href="/login" className={styles.buttonTertiaryText}>
            Sign In
          </Link>
          <Link href="/login" className={styles.buttonPrimary}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.heroBand}>
        <h1 className={styles.displayMega}>
          Build SQL visually.<br />With AI that understands.
        </h1>
        <p className={styles.bodyMd} style={{ maxWidth: '600px', color: 'var(--muted)' }}>
          A quietly-confident natural language interface for executing secure, checked SQL on PostgreSQL databases, coupled with document intelligence.
        </p>
        <div className={styles.heroActions}>
          <Link href="/login" className={styles.buttonDownload}>
            Download for macOS
          </Link>
          <Link href="/login" className={styles.buttonTertiaryText}>
            Web Sandbox
          </Link>
        </div>

        {/* IDE Mockup */}
        <div className={styles.ideMockupCard}>
          <div className={styles.idePaneSidebar}>
            <div className={styles.captionUppercase}>Explorer</div>
            <div className={styles.caption}>pages</div>
            <div className={styles.caption}>components</div>
            <div className={styles.caption}>lib</div>
          </div>
          <div className={styles.idePaneMain}>
            <div className={styles.code}>
              <span style={{ color: 'var(--muted)' }}>// src/lib/db.ts</span><br />
              export const query = async (sql: string) =&gt; {'{'}<br />
              &nbsp;&nbsp;return await db.execute(sql);<br />
              {'}'};
            </div>
          </div>
          <div className={styles.idePaneChat}>
            <div className={styles.captionUppercase}>Agent Timeline</div>
            <div className={styles.timelineGroup}>
              <div className={styles.timelinePillThinking}>Thinking</div>
              <div className={styles.timelineBody}>
                <div className={styles.caption}>Analyzing schema dependencies...</div>
              </div>
            </div>
            <div className={styles.timelineGroup}>
              <div className={styles.timelinePillGrep}>Grepping</div>
              <div className={styles.timelineBody}>
                <div className={styles.caption}>Found 4 matching tables</div>
              </div>
            </div>
            <div className={styles.timelineGroup}>
              <div className={styles.timelinePillEdit}>Editing</div>
              <div className={styles.timelineBody}>
                <div className={styles.caption}>Writing optimized JOIN query</div>
              </div>
            </div>
            <div className={styles.timelineGroup}>
              <div className={styles.timelinePillDone}>Done</div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className={styles.featureSection}>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <h3 className={styles.titleMd}>Context-Aware Editing</h3>
            <p className={styles.bodyMd}>
              Understands your entire database schema and prevents breaking changes before they run.
            </p>
          </div>
          <div className={styles.featureCard}>
            <h3 className={styles.titleMd}>Intelligent Grepping</h3>
            <p className={styles.bodyMd}>
              Search through millions of rows and relationships with natural language instead of complex SQL.
            </p>
          </div>
          <div className={styles.featureCard}>
            <h3 className={styles.titleMd}>Document Intelligence</h3>
            <p className={styles.bodyMd}>
              Extract tables and structured data from PDFs directly into your PostgreSQL database.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.pricingGrid}>
          <div className={styles.pricingTierCard}>
            <h3 className={styles.titleMd}>Hobby</h3>
            <p className={styles.displayMd}>$0 <span className={styles.bodyMd}>/mo</span></p>
            <p className={styles.bodyMd}>Perfect for side projects and learning.</p>
            <Link href="/login" className={styles.buttonSecondary} style={{ marginTop: 'auto' }}>
              Start Free
            </Link>
          </div>
          <div className={styles.pricingTierFeatured}>
            <h3 className={styles.titleMd}>Pro</h3>
            <p className={styles.displayMd}>$20 <span className={styles.bodyMd}>/mo</span></p>
            <p className={styles.bodyMd}>For professional developers and teams.</p>
            <Link href="/login" className={styles.buttonPrimary} style={{ marginTop: 'auto' }}>
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className={styles.ctaBand}>
        <h2 className={styles.displayLg}>
          Ready to build faster?
        </h2>
        <Link href="/login" className={styles.buttonPrimary}>
          Try Conda AI Now
        </Link>
      </section>

      {/* Footer */}
      <footer className={styles.footerWrapper}>
        <div className={styles.footer}>
          <div className={styles.footerCol}>
            <h4 className={styles.captionUppercase}>Product</h4>
            <Link href="#" className={styles.footerLink}>Features</Link>
            <Link href="#" className={styles.footerLink}>Pricing</Link>
            <Link href="#" className={styles.footerLink}>Changelog</Link>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.captionUppercase}>Resources</h4>
            <Link href="#" className={styles.footerLink}>Documentation</Link>
            <Link href="#" className={styles.footerLink}>Blog</Link>
            <Link href="#" className={styles.footerLink}>Community</Link>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.captionUppercase}>Company</h4>
            <Link href="#" className={styles.footerLink}>About</Link>
            <Link href="#" className={styles.footerLink}>Careers</Link>
            <Link href="#" className={styles.footerLink}>Contact</Link>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.captionUppercase}>Legal</h4>
            <Link href="#" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="#" className={styles.footerLink}>Terms of Service</Link>
          </div>
          <div className={styles.footerCol}>
            <p className={styles.bodySm}>
              © 2026 Conda AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
