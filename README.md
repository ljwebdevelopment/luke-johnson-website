# Luke Johnson Website

Static author and columnist website for Luke Johnson.

## Content

All site content — books, publications, columns, and the links out to each
published article — lives in `assets/js/archiveData.js`. The pages render
themselves from it, and the homepage counters (books, columns, publications)
are derived from the same data, so adding a column or an outlet there updates
the whole site. `index.html` carries matching numbers as a no-JS fallback.

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
