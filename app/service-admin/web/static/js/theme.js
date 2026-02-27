(function applyTheme() {
    try {
        var savedTheme = localStorage.getItem('theme');
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var themeToApply = 'dim';
        if (savedTheme) {
            themeToApply = savedTheme;
        } else if (prefersDark) {
            themeToApply = 'dim';
        }
        document.documentElement.setAttribute('data-theme', themeToApply);
        if (!savedTheme && (prefersDark || themeToApply === 'light')) {
            // Only store if it came from system pref or default was applied
            // Avoids overwriting an explicit 'light' choice if system is dark
            // localStorage.setItem('theme', themeToApply); // Decide if you want this behavior
        }

    } catch (e) {
        console.warn("Could not apply initial theme:", e);
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();
