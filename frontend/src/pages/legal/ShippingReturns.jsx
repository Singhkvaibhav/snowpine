export default function ShippingReturns() {
  return (
    <div className="legal-page">
      <h1>Shipping &amp; Returns</h1>
      <p className="muted">Last updated: <span className="review-flag">[FILL IN]</span></p>

      <h2>Shipping</h2>
      <p>
        Snowpine sources products directly from Nordic and European brands/
        distributors and ships them to India. Because items are imported,
        please allow <span className="review-flag">[FILL IN: X-Y business days]</span> for
        delivery from order confirmation. You will receive tracking details by
        email once your order ships.
      </p>
      <p>
        All prices shown include applicable customs duty and GST - there are
        no surprise charges on delivery.
      </p>

      <h2>Returns &amp; Replacements</h2>
      <p>
        Because our catalog is imported, low-volume stock, we are not able to
        offer "change of mind" returns. We will replace or refund an item if:
      </p>
      <ul>
        <li>it arrives damaged in transit (please photograph the packaging and item on arrival), or</li>
        <li>it is defective, or</li>
        <li>the wrong item was shipped.</li>
      </ul>
      <p>
        Report any of the above within <span className="review-flag">[FILL IN: e.g. 48 hours]</span> of
        delivery to <span className="review-flag">[FILL IN: support email]</span> with photos and your
        order number. Approved claims are replaced where stock allows, or
        refunded to your original payment method within{" "}
        <span className="review-flag">[FILL IN: X business days]</span>.
      </p>

      <h2>Cancellations</h2>
      <p>
        Orders can be cancelled for a full refund before they ship. Contact{" "}
        <span className="review-flag">[FILL IN: support email]</span> as soon as possible.
      </p>

      <p className="muted" style={{ marginTop: "2rem" }}>
        This page is a founder-drafted template, not legal advice - have it
        reviewed by counsel before relying on it, particularly for compliance
        with India's Consumer Protection (E-Commerce) Rules, 2020.
      </p>
    </div>
  );
}
