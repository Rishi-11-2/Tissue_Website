# Tissue Ledger

A small sales ledger for a tissue business. It records sales, buying and selling prices, dated manufacturer payments, petrol expenses, and net profit or loss. The website runs free on GitHub Pages and can securely sync its ledger to every phone through Supabase's free tier.

## What it does

- Saves orders with quantity, buying price, selling price, and a note.
- Records dated payments to the manufacturer in a separate payment ledger.
- Stores petrol in a completely separate dated expense ledger.
- Calculates **net profit = sales − stock cost − all petrol expenses**.
- Calculates the outstanding manufacturer due as total stock cost less manufacturer payments. Payments settle stock cost and do not reduce profit twice.
- Lets the user edit, search, sort, and delete orders, manufacturer payments, and petrol expenses.
- Downloads a real Excel `.xlsx` workbook with **Summary**, **Order History**, **Manufacturer Payments**, and **Petrol Expenses** sheets.
- Signs in with a password-free email code. Use the same email on every mobile to see one shared ledger.

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

5. In Supabase **Authentication → Email Templates**, open the **Magic Link** template and replace its body with the following. It is important to use `{{ .Token }}` and not `{{ .ConfirmationURL }}`; that makes Supabase send a six-digit OTP code instead of a link.

   ```html
   <h2>Your Tissue Ledger sign-in code</h2>
   <p>Enter this code in the app:</p>
   <h1 style="letter-spacing: 0.2em;">{{ .Token }}</h1>
   <p>This code expires shortly. If you did not request it, you can ignore this email.</p>
   ```

6. Deploy the updated files to GitHub Pages. On any phone, enter the ledger email and choose **Send code**. Open that email on any device—another phone or a computer is fine—and type the code into the ledger phone. New and changed records sync when saved, when the site opens, when it returns to the foreground, or when **Sync now** is pressed.

The public publishable key in a GitHub Pages app is expected to be visible. The SQL policies limit reads and writes to the signed-in user identified by `auth.uid()`; they protect the ledger records even though the browser key is public. Supabase generates an email OTP when the template includes `{{ .Token }}`, and the app verifies it directly. See Supabase's [Row Level Security guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [email OTP documentation](https://supabase.com/docs/reference/javascript/auth-signinwithotp) for the underlying security model.

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
