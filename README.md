# Tissue Ledger

A small sales ledger for a tissue business. It records sales, buying and selling prices, manufacturer dues, petrol expenses, and net profit or loss. The website runs free on GitHub Pages and can securely sync its ledger to every phone through Supabase's free tier.

## What it does

- Saves orders with quantity, buying price, selling price, manufacturer amount due, and a note.
- Stores petrol in a completely separate dated expense ledger.
- Calculates **net profit = sales − stock cost − all petrol expenses**.
- Shows the outstanding manufacturer due separately, so it is never counted twice as a cost.
- Lets the user edit, search, sort, and delete orders and petrol expenses.
- Downloads a real Excel `.xlsx` workbook with **Summary**, **Order History**, and **Petrol Expenses** sheets.
- Signs in with a password-free email link. Use the same email on every mobile to see one shared ledger.

## One-time cloud sync setup

The site already contains the Supabase client and secure database policies. The following steps create the free cloud database that makes mobile sync possible.

1. Create a free project at [Supabase](https://supabase.com/).
2. In its **SQL Editor**, create a new query, paste the complete contents of [supabase-schema.sql](./supabase-schema.sql), and run it. This creates the two tables and Row Level Security policies.
3. In **Project Settings → API**, copy the **Project URL** and the browser-safe **Publishable key**. Do not use or expose a `service_role` / secret key.
4. Paste those values into [supabase-config.js](./supabase-config.js):

   ```js
   export const SUPABASE_URL = "https://your-project-ref.supabase.co";
   export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
   ```

5. In Supabase **Authentication → URL Configuration**, set the Site URL to the exact GitHub Pages address, for example `https://your-github-name.github.io/tissue-ledger/`. Add that same address to **Redirect URLs**. This lets the email sign-in link return to the website.
6. Deploy the updated files to GitHub Pages. Each phone can then open the site and use the same email address to sign in. New and changed records sync when saved, when the site opens, when it returns to the foreground, or when **Sync now** is pressed.

The public publishable key in a GitHub Pages app is expected to be visible. The SQL policies limit reads and writes to the signed-in user identified by `auth.uid()`; they protect the ledger records even though the browser key is public. See Supabase's [Row Level Security guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [passwordless email login guide](https://supabase.com/docs/guides/auth/auth-email-passwordless?language=js) for the underlying security model.

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
