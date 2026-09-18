export default function Privacy() {
  return (
    <div className="legal-page">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: <span className="review-flag">[FILL IN]</span></p>

      <h2>What we collect</h2>
      <p>
        When you place an order, we collect your name, email address, and
        shipping address in order to fulfil it. Payment details are handled
        directly by <span className="review-flag">[FILL IN: Razorpay/payment partner]</span> - we
        do not receive or store your card/bank details.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To process and ship your order, and contact you about it.</li>
        <li>To respond to support requests.</li>
        <li>
          For basic analytics on site usage - <span className="review-flag">
          [FILL IN if using a specific analytics tool]</span>.
        </li>
      </ul>
      <p>We do not sell your personal data to third parties.</p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of the data we hold about you, or ask us to
        delete it (subject to retaining transaction records as required
        under Indian tax/accounting law), by contacting{" "}
        <span className="review-flag">[FILL IN: support email]</span>.
      </p>

      <p className="muted" style={{ marginTop: "2rem" }}>
        This page is a founder-drafted template, not legal advice - have it
        reviewed by counsel before relying on it, particularly for
        compliance with India's Digital Personal Data Protection Act, 2023.
      </p>
    </div>
  );
}
