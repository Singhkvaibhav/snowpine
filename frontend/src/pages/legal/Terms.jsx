export default function Terms() {
  return (
    <div className="legal-page">
      <h1>Terms of Use</h1>
      <p className="muted">Last updated: <span className="review-flag">[FILL IN]</span></p>

      <h2>1. About Snowpine</h2>
      <p>
        Snowpine ("we", "us") is operated by{" "}
        <span className="review-flag">[FILL IN: registered legal entity name]</span>,{" "}
        <span className="review-flag">[FILL IN: registered address]</span>. GSTIN:{" "}
        <span className="review-flag">[FILL IN]</span>. Grievance officer:{" "}
        <span className="review-flag">[FILL IN: name, email, phone]</span> - as required under
        India's Consumer Protection (E-Commerce) Rules, 2020.
      </p>

      <h2>2. Orders and Pricing</h2>
      <p>
        All prices are listed in INR and include applicable customs duty and
        GST unless stated otherwise. We reserve the right to cancel and
        refund an order if a listed price was a genuine pricing error, or if
        stock is unavailable after an order is placed.
      </p>

      <h2>3. Payments</h2>
      <p>
        Payments are processed by <span className="review-flag">[FILL IN: Razorpay/payment
        partner]</span>. We do not store your card or bank details.
      </p>

      <h2>4. Product Information</h2>
      <p>
        We describe products as accurately as possible based on manufacturer
        information. Minor variations in packaging or color between what is
        shown and what is received may occur, particularly for imported
        stock.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        <span className="review-flag">
          [FILL IN: standard limitation-of-liability clause - have counsel draft this]
        </span>
      </p>

      <h2>6. Governing Law</h2>
      <p>
        These terms are governed by the laws of India, with courts in{" "}
        <span className="review-flag">[FILL IN: city]</span> having exclusive jurisdiction.
      </p>

      <p className="muted" style={{ marginTop: "2rem" }}>
        This page is a founder-drafted template, not legal advice - have it
        reviewed by counsel before relying on it.
      </p>
    </div>
  );
}
