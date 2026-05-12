1.  **Remove CDN Tailwind/CSS config** from `registry-server/src/index.html`. We have correctly migrated to the locally built Tailwind CSS with Vite plugin!
2.  **Update `registry-server/src/App.vue` (Global Layout Layout/Navbar/Footer)**:
    -   Adjust colors and typography to use standard GitHub light/dark themes (or mainly our dark theme mapped to GitHub's dark mode visual language).
    -   Remove "Lobster gradients" and replace with standard buttons, and subtle borders.
    -   Clean up the global top nav (e.g., standard dark gray background `bg-[#010409]`, border-bottom `border-[#30363d]`, etc).
3.  **Update `registry-server/src/views/HomeView.vue` (Explore/Home Page)**:
    -   Align list of repositories, search box, and generic layout with GitHub's dashboard style.
4.  **Update `registry-server/src/views/RepositoryLayout.vue` (Repository Header & Tabs)**:
    -   Redesign the repository header, star/fork/branch buttons to closely match GitHub's repository top-bar.
    -   Update the tab navigation ("Code", "Issues", "Pull Requests") with GitHub's clean border-bottom tabs (`border-transparent hover:border-zinc-300 active:border-orange-500` -> GitHub style with underline and SVG icons).
5.  **Update Repository Tabs (e.g., `CodeTab.vue`)**:
    -   Align the file tree (File Table) with GitHub's `border border-[#30363d] rounded-md` list, alternating rows or just solid background, header with latest commit info.
    -   Update README rendering section to look like GitHub's markdown body.
6.  **Refine typography**: change main font-family to system fonts (like `-apple-system, BlinkMacSystemFont, "Segoe UI", ...` common in GitHub).
