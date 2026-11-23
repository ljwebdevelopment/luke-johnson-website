# lukehjohnson.com

Static author and columnist website for Luke Johnson, served by GitHub Pages
at https://lukehjohnson.com (see `CNAME`).

## Pages

- `index.html` — front page: latest column, more columns, Dead Air America, outlets, books
- `writing.html` — every column and feature (searchable), plus the outlet directory by state
- `books.html` — Dead Air America and the published books
- `about.html` — bio and FAQ
- `contact.html` — contact form
- `404.html` — not-found page

## Content

All site content — books, outlets, columns, and the links out to each
published article — lives in `assets/js/archiveData.js`. The pages render
themselves from it, and the counters (columns, outlets, states) are derived
from the same data, so adding a column or an outlet there updates the whole
site. The HTML carries matching numbers as a no-JS fallback.

Columns display in the order they appear in `archiveItems`: put the newest
first. The first one becomes the lead story on the front page, the next two
sit beneath it.

## Contact Form Google Sheets Setup

The contact form is wired to send submissions to a Google Apps Script Web App. The form posts these columns:

- Timestamp
- Name
- Email
- Subject
- Message
- Source Page
- Inquiry Type

### 1. Create the Google Apps Script

1. Go to [script.google.com](https://script.google.com/).
2. Create a new project.
3. Replace the default code with the contents of `google-apps-script.js`.
4. Save the project.

The script will create or reuse a Google Sheet named `Luke Johnson Website Contacts`.

### 2. Deploy the Web App

1. Click **Deploy**.
2. Choose **New deployment**.
3. Select **Web app**.
4. Set **Execute as** to **Me**.
5. Set **Who has access** to **Anyone**.
6. Deploy and authorize the script.
7. Copy the Web App URL ending in `/exec`.

### 3. Connect the Website

Open `assets/js/contactConfig.js` and paste the Web App URL:

```js
window.contactFormConfig = {
  googleAppsScriptUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
};
```

### 4. Test

Open `contact.html`, submit a test message, then confirm a new row appears in `Luke Johnson Website Contacts`.

Success message:

> Thank you for reaching out. Your message has been received and I will respond as soon as possible.

Error message:

> There was a problem submitting your message. Please try again later.
