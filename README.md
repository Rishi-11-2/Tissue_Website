# Tissue Ledger

A modern, aesthetic sales and operations ledger for a tissue business. It records customer sales, buying and selling prices, dated manufacturer payments, petrol expenses, and live profit metrics. The application features an intelligent customer-grouped ledger that merges name variants, provides segmented views, supports one-click JSON backup & restore to guarantee zero data loss, runs free on GitHub Pages, and seamlessly syncs to all devices via Supabase.

## What it does

- **Customer-Centric Ledger**: Automatically groups all transactions by client with customer summary cards, avatar badges, total spend, order count, and expandable transaction drawers.
- **Smart Name Variant Normalization**: Automatically identifies and groups spelling variations, branch locations, and product-tagged notes (e.g., merging "Aami bangla diamond city" & "Aami bengali diamond city", "Sufi Palace fork", "Karla" & "KarlA", etc.) while preserving the original note on each transaction.
- **Segmented Views**: Switch between **By Customer**, **All Transactions**, **Manufacturer Ledger**, and **Petrol Expenses** with dedicated counters and filtering.
- **Zero-Loss Data Tools**: Built-in modal to export full ledger backups as JSON, import/restore previous backups, or load seed data, alongside the existing multi-sheet Excel `.xlsx` download (**Summary**, **Order History**, **Manufacturer Payments**, and **Petrol Expenses**).
- **Accurate Financial Formulas**:
  - `Net Profit = Total Sales − Stock Cost − Total Petrol Expenses`.
  - `Manufacturer Due = Total Stock Cost − Total Manufacturer Payments`.
  - Payments settle stock cost and never deduct profit twice.
- **Full CRUD Management**: Search, sort, add, edit, and delete orders, petrol expenses, and manufacturer payments directly within customer drawers or global tables.
- **Cross-Device Cloud Sync**: Works completely offline via IndexedDB with automatic background synchronization to Supabase whenever signed in via password-free 6-digit email OTP.

## One-time cloud sync setup

The site already contains the Supabase client and secure database policies. The following steps create the free cloud database that makes mobile sync possible.

1. Create a free project at [Supabase](https://supabase.com/).
2. In its **SQL Editor**, create a new query, paste the complete contents of [supabase-schema.sql](./supabase-schema.sql), and run it. This creates the three ledgers and their Row Level Security policies.
3. In **Project Settings → API**, copy the **Project URL** and the browser-safe **Publishable key**. Do not use or expose a `service_role` / secret key.
4. Paste those values into [supabase-config.js](./supabase-config.js):

   ```js
   export const SUPABASE_URL = "https://your-project-ref.supabase.co";
   export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
   ```

5. In Supabase **Authentication → Email Templates**, open the **Magic Link** template and replace its entire body with the following. It must include `{{ .Token }}` and must not include `{{ .ConfirmationURL }}`—that is what makes Supabase send a six-digit code instead of a link.

   ```html
   <h2>Your Tissue Ledger sign-in code</h2>
   <p>Enter this code in the app:</p>
   <h1 style="letter-spacing: 0.2em;">{{ .Token }}</h1>
   <p>This code expires shortly. If you did not request it, you can ignore this email.</p>
   ```

6. Deploy the updated files to GitHub Pages. On any phone, enter the ledger email and choose **Send code**. Read the email on any device—another phone or a computer is fine—then type the six digits into the ledger on the phone you are signing in to. New and changed records sync when saved, when the site opens, when it returns to the foreground, or when **Sync now** is pressed.

The public publishable key in a GitHub Pages app is expected to be visible. The SQL policies limit reads and writes to the signed-in user identified by `auth.uid()`; they protect the ledger records even though the browser key is public. Supabase sends an email OTP when the template includes `{{ .Token }}`, and the app verifies the code directly. See Supabase's [Row Level Security guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [email OTP documentation](https://supabase.com/docs/reference/javascript/auth-signinwithotp) for the underlying security model.

## Cost and login choices

The database, GitHub Pages site, email-code login, and cross-device sync can all remain on Supabase's **Free** plan for a small personal business. Its free plan includes 500 MB of database space and 50,000 monthly active users. A free project pauses after one week without activity, then wakes when it is used again.

Supabase's built-in email sender is best-effort and currently allows only **2 auth emails per hour**. This is enough for occasional sign-ins, but it may be inconvenient while setting up several phones. If that limit is a problem, add an SMTP service with a free monthly tier in Supabase **Authentication → SMTP Settings**; the website code does not need to change.

The app intentionally does not offer SMS / phone-number OTP. Every real SMS is delivered by an SMS provider, which creates a per-message cost and Supabase's advanced phone authentication is not part of the Free plan. Email OTP is the no-cost option: the target phone does not need the email account, only the six-digit code from a device that can open the inbox.

## Run locally

Open `index.html` in a modern browser, or use a lightweight local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Cloud sign-in only works after the Supabase configuration above is added.

## Deploy to GitHub Pages

1. Create a GitHub repository and push these files to its `main` or `master` branch.
2. On GitHub, open **Settings → Pages**.
3. Select **GitHub Actions** as the build source.
4. Push a change. The included workflow deploys the static website automatically.

GitHub displays the public Pages URL in the Pages settings and the successful workflow run. Use that exact URL in Supabase's URL Configuration before testing email sign-in.
