/** Where the light/dark choice is kept in this browser. */
export const THEME_KEY = "ghoomo-theme";

/** Runs before first paint (see app/layout.tsx), so a saved theme applies without a flash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
