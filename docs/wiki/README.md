# User guides (wiki source)

These pages are the app's user guides, written in GitHub-wiki format
(`_Sidebar.md`, bare page links like `[Reports](Reports)`). They are
versioned here so guide changes ride along with the features they describe.

## Publishing to the GitHub wiki

GitHub only creates a repository's wiki once its **first page is made in
the web UI** — there is no API for it. One-time setup:

1. Open https://github.com/reynen-ramos/dragonboat-manager/wiki and click
   **Create the first page** (any content — it's about to be replaced).
2. Then, from the repository root:

   ```sh
   git clone https://github.com/reynen-ramos/dragonboat-manager.wiki.git ../dragonboat-manager.wiki
   cp docs/wiki/*.md ../dragonboat-manager.wiki/
   rm ../dragonboat-manager.wiki/README.md
   cd ../dragonboat-manager.wiki
   git add -A && git commit -m "Publish user guides" && git push
   ```

Repeat steps 2's copy/commit/push whenever these pages change (the wiki
has no PR flow; this folder is where guide edits get reviewed).

Note: the bare link style is correct on the wiki but does not resolve when
browsing this folder on github.com — start from `Home.md` and follow file
names if reading here.
