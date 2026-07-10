# Blackstone Ops — Mac Setup
## Run these commands in Terminal, one block at a time

---

### STEP 1 — Create the project on your Desktop

```bash
cd ~/Desktop
npx create-next-app@latest blackstone-ops --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
cd blackstone-ops
```

When it asks questions just hit Enter for all defaults.

---

### STEP 2 — Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react
npm install clsx tailwind-merge
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install sonner
npm install qrcode.react
npm install zustand
```

---

### STEP 3 — Open in VS Code

```bash
code .
```

If `code` command not found, open VS Code manually → File → Open Folder → Desktop → blackstone-ops

---

### STEP 4 — Start the dev server

```bash
npm run dev
```

Open http://localhost:3000

---

That's it for now. Paste back here when you see the Next.js welcome page on localhost:3000
