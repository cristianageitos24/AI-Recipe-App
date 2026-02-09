# Concurrently & EPERM on Windows

We no longer run dev and workers with concurrently; use two terminals or `dev-all.bat` (see [WORKERS.md](WORKERS.md)). This file is kept for reference if you use concurrently elsewhere.

---

**Reference:** `npm run dev:all` used to use **concurrently** to run the Next.js dev server and the video worker in one terminal. On Windows it could fail with:

```text
Error: spawn EPERM
```

That means the system (or security software) is blocking Node from spawning child processes.

## What Concurrently Does on Windows

- It uses Node’s `child_process.spawn()` to run **cmd.exe** with your commands.
- It needs permission to start `cmd.exe` (and then `node`/`npm` inside it).

## What to Try (in order)

### 1. Use Command Prompt instead of PowerShell

Run `npm run dev:all` from **Command Prompt (cmd.exe)**, not PowerShell or Git Bash:

- Press Win + R → type `cmd` → Enter.
- Then:
  ```cmd
  cd "c:\Users\ChristianAgeitos\Documents\Almika Codes\Cursor\AI - Recipe App\HomeRecipe\next-app"
  npm run dev:all
  ```

### 2. Run the terminal as Administrator

- Right‑click **Command Prompt** or **Windows Terminal** → **Run as administrator**.
- `cd` to the project and run `npm run dev:all` again.

### 3. Add a Windows Defender / antivirus exclusion

So security software doesn’t block Node or the project:

1. **Windows Security** → **Virus & threat protection** → **Manage settings** under “Virus & threat protection settings”.
2. Scroll to **Exclusions** → **Add or remove exclusions** → **Add an exclusion**.
3. Add:
   - **Folder**: your project folder, e.g.  
     `C:\Users\ChristianAgeitos\Documents\Almika Codes\Cursor\AI - Recipe App\HomeRecipe\next-app`
   - Optionally **Folder**: your Node.js install, e.g.  
     `C:\Program Files\nodejs`

If you use another antivirus, add the same folders as exclusions there.

### 4. Don’t use concurrently: run dev and worker separately

You can avoid concurrently completely:

**Option A – Two terminals**

1. Terminal 1:
   ```cmd
   cd "c:\...\HomeRecipe\next-app"
   npm run dev
   ```
2. Terminal 2:
   ```cmd
   cd "c:\...\HomeRecipe\next-app"
   npm run worker:video
   ```

**Option B – Windows batch script (one double‑click)**

Use the provided `dev-all.bat` in this folder: double‑click it to start both the dev server and the video worker in separate windows. No permissions change needed for that.

---

## Summary

| Fix | What it does |
|-----|----------------|
| Use **cmd.exe** | Avoids shell differences that can trigger EPERM. |
| **Run as Administrator** | Gives the terminal permission to spawn child processes. |
| **Antivirus/Defender exclusion** | Stops security software from blocking Node/cmd.exe. |
| **dev-all.bat** or two terminals | Runs dev + worker without using concurrently. |

The underlying need is: **allow Node.js to spawn `cmd.exe`** (and thus run `npm run dev` and `npm run worker:video`). Anything that blocks that (policy, antivirus, or shell) can cause EPERM.
