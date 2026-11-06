/*
 * Client forms shown on forms.html.
 *
 * To add a form: copy one of the objects below, give it a new unique `id`,
 * and list its fields. Field types: text, email, tel, date, number,
 * textarea, select (needs `options`), radio (needs `options`), checkbox.
 * Set `required: true` on anything the client must fill in.
 *
 * Forms with `requestOnly: true` are not filled in on the site. Instead the
 * client asks Bill to send it through his e-signature tool (used for official
 * association contracts such as buyer or listing agreements).
 */
window.CLIENT_FORMS = [
  {
    id: "buyer-questionnaire",
    title: "Buyer Questionnaire",
    summary: "Tell me what you're looking for so I can start your home search.",
    sections: [
      {
        heading: "About you",
        fields: [
          { name: "full_name", label: "Full name", type: "text", required: true, autocomplete: "name" },
          { name: "email", label: "Email", type: "email", required: true, autocomplete: "email" },
          { name: "phone", label: "Phone", type: "tel", required: true, autocomplete: "tel" },
          { name: "co_buyer", label: "Co-buyer name (if any)", type: "text" },
          {
            name: "contact_pref", label: "Best way to reach you", type: "radio",
            options: ["Call", "Text", "Email"], required: true,
          },
        ],
      },
      {
        heading: "The home you want",
        fields: [
          { name: "areas", label: "Cities, neighborhoods, or school districts", type: "text", required: true },
          {
            name: "property_type", label: "Property type", type: "select", required: true,
            options: ["Single-family", "Townhome", "Condo", "Multi-family", "Land", "Not sure yet"],
          },
          { name: "price_min", label: "Lowest price ($)", type: "number" },
          { name: "price_max", label: "Highest price ($)", type: "number", required: true },
          { name: "beds", label: "Bedrooms (minimum)", type: "number" },
          { name: "baths", label: "Bathrooms (minimum)", type: "number" },
          { name: "must_haves", label: "Must-haves and deal-breakers", type: "textarea" },
        ],
      },
      {
        heading: "Timing and financing",
        fields: [
          {
            name: "timeline", label: "When would you like to move?", type: "select", required: true,
            options: ["Within 30 days", "1-3 months", "3-6 months", "6+ months", "Just looking"],
          },
          {
            name: "financing", label: "How are you paying?", type: "radio", required: true,
            options: ["Mortgage, pre-approved", "Mortgage, not pre-approved yet", "Cash", "Not sure"],
          },
          { name: "lender", label: "Lender name (if pre-approved)", type: "text" },
          { name: "home_to_sell", label: "I have a home I need to sell first", type: "checkbox" },
          { name: "notes", label: "Anything else I should know?", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "seller-questionnaire",
    title: "Seller Questionnaire",
    summary: "Thinking of selling? Share a few details about your home.",
    sections: [
      {
        heading: "About you",
        fields: [
          { name: "full_name", label: "Full name", type: "text", required: true, autocomplete: "name" },
          { name: "email", label: "Email", type: "email", required: true, autocomplete: "email" },
          { name: "phone", label: "Phone", type: "tel", required: true, autocomplete: "tel" },
          { name: "other_owners", label: "Other owners on title (if any)", type: "text" },
        ],
      },
      {
        heading: "Your property",
        fields: [
          { name: "address", label: "Property address", type: "text", required: true, autocomplete: "street-address" },
          {
            name: "property_type", label: "Property type", type: "select", required: true,
            options: ["Single-family", "Townhome", "Condo", "Multi-family", "Land", "Other"],
          },
          { name: "beds", label: "Bedrooms", type: "number" },
          { name: "baths", label: "Bathrooms", type: "number" },
          { name: "year_built", label: "Year built (approx.)", type: "number" },
          { name: "updates", label: "Recent updates or repairs", type: "textarea" },
          { name: "price_hope", label: "Price you have in mind ($)", type: "number" },
        ],
      },
      {
        heading: "Timing",
        fields: [
          {
            name: "timeline", label: "When would you like to sell?", type: "select", required: true,
            options: ["As soon as possible", "1-3 months", "3-6 months", "6+ months", "Just curious"],
          },
          { name: "buying_next", label: "I also need help buying my next home", type: "checkbox" },
          { name: "notes", label: "Anything else I should know?", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "buyer-agreement",
    title: "Buyer Representation Agreement",
    summary: "The official agreement to work together. I'll email it to you to sign electronically.",
    requestOnly: true,
  },
];
